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

const parseMock = vi.fn(
  async (_params: { model: string; messages: { content: string }[] }) => ({
    parsed_output: RESUMO_FALSO as ResumoCaso | null,
  }),
);

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { parse: parseMock };
  },
}));

process.env.ANTHROPIC_API_KEY = "sk-ant-teste";

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
  it("envia o dossiê ao modelo claude-sonnet-5-5 e devolve a saída estruturada", async () => {
    parseMock.mockClear();
    const resumo = await gerarResumoCaso(DOSSIE_FALSO);
    expect(resumo).toEqual(RESUMO_FALSO);

    expect(parseMock).toHaveBeenCalledTimes(1);
    const chamada = parseMock.mock.calls[0]![0];
    expect(chamada.model).toBe("claude-sonnet-5-5");
    expect(chamada.messages[0]!.content).toContain(DOSSIE_FALSO.protocol);
    expect(chamada.messages[0]!.content).toContain(DOSSIE_FALSO.narrative);
  });

  it("lança erro claro se a IA não devolver saída estruturada válida", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: null });
    await expect(gerarResumoCaso(DOSSIE_FALSO)).rejects.toThrow(
      "Não foi possível interpretar a resposta da IA.",
    );
  });
});
