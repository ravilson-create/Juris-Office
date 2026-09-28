import { describe, expect, it } from "vitest";
import { formatAnswer, parseAnswer, toFormValue } from "@/domain/triage/engine";
import { MONEY_MAX_CENTS, parseMoney } from "@/domain/triage/money";
import type { TriageQuestion } from "@/domain/triage/schema";

const currency = {
  id: "00000000-0000-4000-8000-000000000001",
  legalAreaId: "00000000-0000-4000-8000-000000000002",
  key: "valor",
  label: "Valor",
  type: "currency",
  required: false,
  sortOrder: 1,
  active: true,
  section: "S",
} as TriageQuestion;

describe("parseMoney — formatos aceitos (centavos inteiros)", () => {
  it.each([
    ["1234", 123400],
    ["1.234", 123400],
    ["1234,56", 123456],
    ["1.234,56", 123456],
    ["1234.56", 123456],
    ["R$ 1.234,56", 123456],
    ["R$1.234,5", 123450],
    ["  0,99 ", 99],
    ["0", 0],
    ["1.2", 120],
    ["12.345.678,90", 1234567890],
    ["1.000.000.000,00", MONEY_MAX_CENTS],
  ])("%s → %i centavos", (input, cents) => {
    expect(parseMoney(input)).toEqual({ ok: true, cents });
  });
});

describe("parseMoney — recusa sem converter em outro valor", () => {
  it.each([
    "1.2.3",
    "1.2345",
    "12.34.567",
    "1,234",
    "1,234.56",
    "1.234.56",
    "1,2,3",
    "-10",
    "10,",
    ",50",
    "1 234",
    "abc",
    "",
    "R$",
    "1e3",
  ])("%s", (input) => {
    expect(parseMoney(input).ok).toBe(false);
  });

  it("recusa acima do limite, com mensagem do máximo", () => {
    const r = parseMoney("1.000.000.000,01");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/máximo/);
    expect(parseMoney("99999999999").ok).toBe(false);
    expect(parseMoney("9".repeat(40)).ok).toBe(false);
  });
});

describe("valor mantém o significado do formulário até o dossiê", () => {
  it.each([
    ["1.234,56", "1.234,56"],
    ["1234.56", "1.234,56"],
    ["0,05", "0,05"],
    ["1.000.000,00", "1.000.000,00"],
    ["1.234", "1.234,00"],
  ])("%s → R$ %s", (input, shown) => {
    const first = parseAnswer(currency, input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Voltar ao formulário (retomar/corrigir) e salvar de novo não altera o valor.
    expect(parseAnswer(currency, toFormValue(currency, first.value))).toEqual(first);
    // Revisão e dossiê usam a mesma formatação.
    expect(formatAnswer(currency, first.value).replace(/\s/g, " ")).toBe(`R$ ${shown}`);
  });

  it("formata para revisão e dossiê em reais", () => {
    const r = parseAnswer(currency, "1.234,5");
    expect(r.ok && formatAnswer(currency, r.value)).toMatch(/^R\$\s1\.234,50$/);
  });

  it("respeita mínimo e máximo configurados em reais", () => {
    const q = { ...currency, constraints: { min: 10, max: 100 } } as TriageQuestion;
    expect(parseAnswer(q, "9,99").ok).toBe(false);
    expect(parseAnswer(q, "10").ok).toBe(true);
    expect(parseAnswer(q, "100,00").ok).toBe(true);
    expect(parseAnswer(q, "100,01").ok).toBe(false);
  });
});
