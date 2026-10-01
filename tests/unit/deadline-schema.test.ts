import { describe, expect, it } from "vitest";
import { calcularDataFinal } from "@/domain/deadline/schema";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("calcularDataFinal", () => {
  it("dias corridos: soma direto, sem pular nada", () => {
    const resultado = calcularDataFinal(new Date("2026-10-01T00:00:00Z"), 15, "calendar_days");
    expect(iso(resultado)).toBe("2026-10-16");
  });

  it("dias úteis: pula sábado e domingo", () => {
    // 2026-10-01 é quinta. +1 dia útil = sexta (02); +2 = segunda (05), pulando o fim de semana.
    expect(iso(calcularDataFinal(new Date("2026-10-01T00:00:00Z"), 1, "business_days"))).toBe(
      "2026-10-02",
    );
    expect(iso(calcularDataFinal(new Date("2026-10-01T00:00:00Z"), 2, "business_days"))).toBe(
      "2026-10-05",
    );
  });

  it("dias úteis contando a partir de uma sexta: pula o fim de semana inteiro", () => {
    // 2026-10-02 é sexta. +1 dia útil = segunda (05), nunca sábado/domingo.
    expect(iso(calcularDataFinal(new Date("2026-10-02T00:00:00Z"), 1, "business_days"))).toBe(
      "2026-10-05",
    );
  });

  it("zero dias devolve a própria data de início", () => {
    expect(iso(calcularDataFinal(new Date("2026-10-01T00:00:00Z"), 0, "calendar_days"))).toBe(
      "2026-10-01",
    );
    expect(iso(calcularDataFinal(new Date("2026-10-01T00:00:00Z"), 0, "business_days"))).toBe(
      "2026-10-01",
    );
  });

  it("nunca muta a data de início recebida", () => {
    const inicio = new Date("2026-10-01T00:00:00Z");
    calcularDataFinal(inicio, 10, "business_days");
    expect(iso(inicio)).toBe("2026-10-01");
  });
});
