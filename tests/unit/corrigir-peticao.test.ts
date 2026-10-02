import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateTextMock = vi.fn(async (_params: { model: string; prompt: string }) => ({
  output: { corpoCorrigido: "Texto corrigido da seção." },
  finalStep: { response: { modelId: "anthropic/claude-sonnet-5-5-0101" as string | undefined } },
}));

vi.mock("ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("ai")>();
  return { ...real, generateText: generateTextMock };
});

process.env.AI_GATEWAY_MODEL = "anthropic/claude-sonnet-5-5";

const { gerarCorrecaoSecao } = await import("@/lib/ai/corrigir-peticao");

describe("gerarCorrecaoSecao", () => {
  it("envia área, modelo e texto atual, e devolve o texto corrigido com o modelo resolvido", async () => {
    generateTextMock.mockClear();
    const { corpoCorrigido, modelo } = await gerarCorrecaoSecao({
      areaNome: "Família",
      tituloModelo: "Ação de Alimentos",
      tituloSecao: "Dos fatos",
      corpoAtual: "O requerente precisa de pensão.",
    });
    expect(corpoCorrigido).toBe("Texto corrigido da seção.");
    expect(modelo).toBe("anthropic/claude-sonnet-5-5-0101");
    const prompt = generateTextMock.mock.calls[0][0].prompt;
    expect(prompt).toContain("Família");
    expect(prompt).toContain("Ação de Alimentos");
    expect(prompt).toContain("O requerente precisa de pensão.");
  });

  it("recorre ao modelo configurado quando o Gateway não informa o modelId resolvido", async () => {
    generateTextMock.mockClear();
    generateTextMock.mockImplementationOnce(async () => ({
      output: { corpoCorrigido: "Texto." },
      finalStep: { response: { modelId: undefined as string | undefined } },
    }));
    const { modelo } = await gerarCorrecaoSecao({
      areaNome: "Cível",
      tituloModelo: "Ação de Cobrança",
      tituloSecao: "Dos pedidos",
      corpoAtual: "Pede-se a condenação.",
    });
    expect(modelo).toBe("anthropic/claude-sonnet-5-5");
  });

  it("propaga erro de geração para o chamador tratar", async () => {
    generateTextMock.mockClear();
    generateTextMock.mockImplementationOnce(async () => {
      throw new Error("falha simulada");
    });
    await expect(
      gerarCorrecaoSecao({
        areaNome: "Trabalhista",
        tituloModelo: "Reclamação Trabalhista",
        tituloSecao: "Dos fatos",
        corpoAtual: "Texto.",
      }),
    ).rejects.toThrow("falha simulada");
  });
});
