import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateTextMock = vi.fn(async (_params: { model: string; prompt: string }) => ({
  output: { textoAuxiliado: "Texto do campo no padrão jurídico." },
  finalStep: { response: { modelId: "anthropic/claude-sonnet-5-5-0101" as string | undefined } },
}));

vi.mock("ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("ai")>();
  return { ...real, generateText: generateTextMock };
});

process.env.AI_GATEWAY_MODEL = "anthropic/claude-sonnet-5-5";

const { gerarAuxilioCampoPeca } = await import("@/lib/ai/auxiliar-campo-peca");

describe("gerarAuxilioCampoPeca", () => {
  it("envia peça, campo e anotação, e devolve o texto auxiliado com o modelo resolvido", async () => {
    generateTextMock.mockClear();
    const { textoAuxiliado, modelo } = await gerarAuxilioCampoPeca({
      tituloPeca: "Reconvenção",
      rotuloCampo: "Fatos em que se baseia o pedido contra o autor",
      notaAdvogado: "o autor também deve ao réu, não falou isso na inicial",
    });
    expect(textoAuxiliado).toBe("Texto do campo no padrão jurídico.");
    expect(modelo).toBe("anthropic/claude-sonnet-5-5-0101");
    const prompt = generateTextMock.mock.calls[0][0].prompt;
    expect(prompt).toContain("Reconvenção");
    expect(prompt).toContain("Fatos em que se baseia o pedido contra o autor");
    expect(prompt).toContain("o autor também deve ao réu, não falou isso na inicial");
  });

  it("recorre ao modelo configurado quando o Gateway não informa o modelId resolvido", async () => {
    generateTextMock.mockClear();
    generateTextMock.mockImplementationOnce(async () => ({
      output: { textoAuxiliado: "Texto." },
      finalStep: { response: { modelId: undefined as string | undefined } },
    }));
    const { modelo } = await gerarAuxilioCampoPeca({
      tituloPeca: "Embargos à Execução",
      rotuloCampo: "Matéria de defesa alegada contra a execução",
      notaAdvogado: "já pagou, tem o comprovante",
    });
    expect(modelo).toBe("anthropic/claude-sonnet-5-5");
  });

  it("propaga erro de geração para o chamador tratar", async () => {
    generateTextMock.mockClear();
    generateTextMock.mockImplementationOnce(async () => {
      throw new Error("falha simulada");
    });
    await expect(
      gerarAuxilioCampoPeca({
        tituloPeca: "Agravo de Instrumento",
        rotuloCampo: "Teor da decisão agravada",
        notaAdvogado: "juiz negou a prova",
      }),
    ).rejects.toThrow("falha simulada");
  });
});
