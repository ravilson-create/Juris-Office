import { describe, expect, it, vi } from "vitest";
import type { Dossier } from "@/domain/dossier/schema";
import type { ResumoCaso } from "@/domain/ai/resumo";

vi.mock("server-only", () => ({}));

const RESUMO_FALSO: ResumoCaso = {
  sintese: "Síntese de teste.",
  pedidoPrincipal: "Pedido de teste.",
  pontosChave: ["Ponto 1"],
  documentosFaltantes: [],
  riscosAparentes: [],
};

const generateTextMock = vi.fn(async (_params: { model: string; prompt: string }) => ({
  output: RESUMO_FALSO as ResumoCaso,
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
      output: RESUMO_FALSO,
      finalStep: { response: { modelId: undefined } },
    });
    const { modelo } = await gerarResumoCaso(DOSSIE_FALSO);
    expect(modelo).toBe("anthropic/claude-sonnet-5-5");
  });

  it("propaga o erro quando a IA não produz saída válida", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("NoOutputGeneratedError"));
    await expect(gerarResumoCaso(DOSSIE_FALSO)).rejects.toThrow("NoOutputGeneratedError");
  });
});
