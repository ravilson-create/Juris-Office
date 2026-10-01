import { describe, expect, it } from "vitest";
import { resumirContagemPorStatus } from "@/domain/case/dashboard";
import { STATUS_PROFISSIONAL } from "@/domain/case/status";

describe("resumirContagemPorStatus", () => {
  it("sem nenhuma linha, devolve todo status profissional com zero", () => {
    const resumo = resumirContagemPorStatus([]);
    expect(resumo.total).toBe(0);
    expect(resumo.porStatus).toHaveLength(STATUS_PROFISSIONAL.length);
    expect(resumo.porStatus.every((item) => item.total === 0)).toBe(true);
  });

  it("soma corretamente e converte count (string do Postgres) para número", () => {
    const resumo = resumirContagemPorStatus([
      { status: "submitted", count: "3" },
      { status: "active", count: "2" },
    ]);
    expect(resumo.total).toBe(5);
    expect(resumo.porStatus.find((i) => i.status === "submitted")?.total).toBe(3);
    expect(resumo.porStatus.find((i) => i.status === "active")?.total).toBe(2);
    expect(resumo.porStatus.find((i) => i.status === "closed")?.total).toBe(0);
  });

  it("ignora status que não é profissional (nunca deveria vir do banco, mas não quebra)", () => {
    const resumo = resumirContagemPorStatus([{ status: "draft", count: "9" }]);
    expect(resumo.total).toBe(0);
  });

  it("cada item carrega o rótulo em português correspondente", () => {
    const resumo = resumirContagemPorStatus([]);
    const item = resumo.porStatus.find((i) => i.status === "under_legal_review");
    expect(item?.label).toBe("Em análise pelo advogado");
  });
});
