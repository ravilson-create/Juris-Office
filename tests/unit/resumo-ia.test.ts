import { describe, expect, it, vi } from "vitest";
import type { Dossier } from "@/domain/dossier/schema";
import type { ResumoCaso } from "@/domain/ai/resumo";
import { MockLanguageModelV4 } from "ai/test";

vi.mock("server-only", () => ({}));

const RESUMO_FALSO: ResumoCaso = {
  sintese: "Síntese de teste.",
  pedidoPrincipal: "Pedido de teste.",
  pontosChave: ["Ponto 1"],
  documentosFaltantes: [],
  riscosAparentes: [],
};

const generateTextMock = vi.fn(async (_params: { model: string; prompt: string }) => ({
  toolCalls: [{ toolName: "resumo_caso", input: RESUMO_FALSO, invalid: false }],
  finalStep: { response: { modelId: "anthropic/claude-sonnet-5-5-0101" as string | undefined } },
}));

vi.mock("ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("ai")>();
  return { ...real, generateText: generateTextMock };
});

process.env.AI_GATEWAY_MODEL = "anthropic/claude-sonnet-5-5";

const { gerarResumoCaso } = await import("@/lib/ai/resumo-caso");

const DOSSIE_FALSO: Dossier = {
  id: "00000000-0000-4000-8000-000000000001",
  caseId: "00000000-0000-4000-8000-000000000002",
  version: 1,
  protocol: "JO-TESTE",
  areaName: "Cível",
  applicant: {
    fullName: "Fulano de Tal",
    cpf: "11144477735",
    email: "fulano@example.com",
    phone: "11999999999",
    city: "São Paulo",
    uf: "SP",
  },
  factsSummary: "Resumo dos fatos.",
  narrative: "Relato completo dos fatos.",
  triageSections: [],
  parties: [],
  chronology: [],
  amounts: [],
  documents: [],
  actionsTaken: [],
  missingInformation: ["Comprovante de residência"],
  observations: [],
  disclaimer: "Aviso de revisão profissional.",
  createdAt: new Date().toISOString(),
};

describe("gerarResumoCaso", () => {
  it("envia o dossiê ao modelo do Gateway e devolve a saída estruturada com o modelo resolvido", async () => {
    generateTextMock.mockClear();
    const { resumo, modelo } = await gerarResumoCaso(DOSSIE_FALSO);
    expect(resumo).toEqual(RESUMO_FALSO);
    expect(modelo).toBe("anthropic/claude-sonnet-5-5-0101");

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const chamada = generateTextMock.mock.calls[0]![0];
    expect(chamada.model).toBe("anthropic/claude-sonnet-5-5");
    expect(chamada.prompt).toContain(DOSSIE_FALSO.protocol);
    expect(chamada.prompt).toContain(DOSSIE_FALSO.narrative);
  });

  it("usa a string configurada como modelo se o Gateway não informar qual resolveu", async () => {
    generateTextMock.mockResolvedValueOnce({
      toolCalls: [{ toolName: "resumo_caso", input: RESUMO_FALSO, invalid: false }],
      finalStep: { response: { modelId: undefined } },
    });
    const { modelo } = await gerarResumoCaso(DOSSIE_FALSO);
    expect(modelo).toBe("anthropic/claude-sonnet-5-5");
  });

  it("propaga o erro quando a IA não produz saída válida", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("NoOutputGeneratedError"));
    await expect(gerarResumoCaso(DOSSIE_FALSO)).rejects.toThrow("NoOutputGeneratedError");
  });

  it.each([undefined, { ...RESUMO_FALSO, pontosChave: [] }])(
    "recusa resposta ausente ou fora do schema sem devolver conteúdo para salvar",
    async (input) => {
      generateTextMock.mockResolvedValueOnce({
        toolCalls: input ? [{ toolName: "resumo_caso", input, invalid: false }] : [],
        finalStep: { response: { modelId: undefined } },
      });
      await expect(gerarResumoCaso(DOSSIE_FALSO)).rejects.toThrow();
    },
  );

  it("o SDK envia ferramenta obrigatória sem response_format e valida os argumentos", async () => {
    generateTextMock.mockClear();
    await gerarResumoCaso(DOSSIE_FALSO);
    const params = generateTextMock.mock.calls[0]![0];
    const real = await vi.importActual<typeof import("ai")>("ai");
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        expect(options.responseFormat?.type).not.toBe("json");
        expect(options.toolChoice).toEqual({ type: "tool", toolName: "resumo_caso" });
        expect(options.tools?.[0]).toMatchObject({ name: "resumo_caso", type: "function" });
        return {
          content: [
            {
              type: "tool-call",
              toolCallId: "resumo-1",
              toolName: "resumo_caso",
              input: JSON.stringify(RESUMO_FALSO),
            },
          ],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 10, text: 10, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });
    const result = await real.generateText({ ...params, model });
    expect(result.toolCalls[0]?.input).toEqual(RESUMO_FALSO);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
