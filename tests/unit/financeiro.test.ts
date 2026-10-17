import { describe, expect, it } from "vitest";
import { csvCell, entrySchema, moneyInput, splitInstallments } from "@/domain/financeiro/schema";

describe("financeiro manual", () => {
  it("distribui centavos e preserva o dia original nos finais de mês", () => {
    const rows = splitInstallments(10000, 3, "2028-01-31");
    expect(rows.map((p) => p.amountCents)).toEqual([3334, 3333, 3333]);
    expect(rows.map((p) => p.dueDate)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
    expect(() => splitInstallments(1, 2, "2026-01-01")).toThrow();
  });
  it("interpreta valores sem flutuação nem separadores ambíguos", () => {
    expect(moneyInput("1250,51")).toBe(125051);
    expect(moneyInput("0.01")).toBe(1);
    for (const s of ["1.250,50", "1e3", "-1", "12,123", ""]) expect(() => moneyInput(s)).toThrow();
  });
  it("rejeita data inexistente e categoria incompatível", () => {
    const base = {
      requestId: crypto.randomUUID(),
      description: "Teste",
      counterparty: "Cliente",
      kind: "honorarios",
      direction: "receber",
      amountCents: 100,
      dueDate: "2026-10-01",
      installments: 1,
      caseId: null,
      notes: "",
    };
    expect(entrySchema.safeParse(base).success).toBe(true);
    expect(entrySchema.safeParse({ ...base, dueDate: "2026-02-30" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...base, direction: "pagar" }).success).toBe(false);
  });
  it("protege células CSV contra fórmulas e escapa aspas", () => {
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell('A "B"')).toBe('"A ""B"""');
    expect(csvCell("\t+cmd")).toContain("'");
  });
});
