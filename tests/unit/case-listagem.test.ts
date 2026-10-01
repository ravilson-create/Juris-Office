import { describe, expect, it } from "vitest";
import { calcularPaginacao } from "@/domain/case/listagem";
import { statusProfissionalValido } from "@/domain/case/status";

describe("calcularPaginacao", () => {
  it("primeira página com poucos itens: 1 página só", () => {
    expect(calcularPaginacao(5, 1, 20)).toEqual({ pagina: 1, totalPaginas: 1, offset: 0 });
  });

  it("calcula o offset certo na segunda página", () => {
    expect(calcularPaginacao(45, 2, 20)).toEqual({ pagina: 2, totalPaginas: 3, offset: 20 });
  });

  it("nunca deixa passar da última página, mesmo pedindo muito além", () => {
    expect(calcularPaginacao(45, 9999, 20)).toEqual({ pagina: 3, totalPaginas: 3, offset: 40 });
  });

  it("nunca deixa ir para página zero ou negativa", () => {
    expect(calcularPaginacao(45, 0, 20).pagina).toBe(1);
    expect(calcularPaginacao(45, -5, 20).pagina).toBe(1);
  });

  it("entrada não numérica (NaN) cai na primeira página, nunca quebra", () => {
    expect(calcularPaginacao(45, Number("abc"), 20).pagina).toBe(1);
  });

  it("zero itens ainda é 1 página (nunca divide por zero / totalPaginas zero)", () => {
    expect(calcularPaginacao(0, 1, 20)).toEqual({ pagina: 1, totalPaginas: 1, offset: 0 });
  });
});

describe("statusProfissionalValido", () => {
  it("aceita um status profissional", () => {
    expect(statusProfissionalValido("under_legal_review")).toBe("under_legal_review");
  });

  it("rejeita status de cidadão (draft, triage etc.) — não é isso que a tela filtra", () => {
    expect(statusProfissionalValido("draft")).toBeNull();
    expect(statusProfissionalValido("triage")).toBeNull();
  });

  it("rejeita valor arbitrário, vazio ou ausente", () => {
    expect(statusProfissionalValido("qualquer-coisa")).toBeNull();
    expect(statusProfissionalValido("")).toBeNull();
    expect(statusProfissionalValido(undefined)).toBeNull();
  });
});
