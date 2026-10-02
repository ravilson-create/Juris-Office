import { describe, expect, it, vi } from "vitest";
import type { PetitionDocument } from "@/domain/petition/schema";

vi.mock("server-only", () => ({}));

const { peticaoParaPdfBuffer } = await import("@/lib/petitions/pdf");

const DOCUMENTO: PetitionDocument = {
  modeloId: "civel.acao_cobranca",
  tituloModelo: "Ação de Cobrança",
  secoes: [
    { chave: "fatos", titulo: "Dos Fatos", corpo: "Texto dos fatos.\nSegundo parágrafo." },
    { chave: "pedidos", titulo: "Dos Pedidos", corpo: "Texto dos pedidos." },
  ],
  pendencias: [],
};

describe("peticaoParaPdfBuffer", () => {
  it("gera um PDF válido (assinatura %PDF- no início, %%EOF no fim)", async () => {
    const buffer = await peticaoParaPdfBuffer(DOCUMENTO);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.subarray(-7).toString("latin1").trim()).toMatch(/%%EOF$/);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("não lança com texto contendo acentuação do português", async () => {
    const comAcentos: PetitionDocument = {
      ...DOCUMENTO,
      secoes: [{ chave: "fatos", titulo: "Dos Fatos", corpo: "Ação, condição, não, José, Núñez." }],
    };
    await expect(peticaoParaPdfBuffer(comAcentos)).resolves.toBeInstanceOf(Buffer);
  });
});
