import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  list: vi.fn(),
  summary: vi.fn(),
  cash: vi.fn(),
  options: vi.fn(),
  history: vi.fn(),
}));
vi.mock("@/lib/auth/financeiro-acesso", () => ({ requireFinancialAccess: mocks.access }));
vi.mock("@/lib/services/financeiro", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/financeiro")>()),
  listFinancialEntries: mocks.list,
  financialSummary: mocks.summary,
  financialCashFlow: mocks.cash,
  financialOptions: mocks.options,
  financialHistory: mocks.history,
}));
vi.mock("server-only", () => ({}));
const { GET } = await import("@/app/equipe/financeiro/relatorio/route");
const { default: Page } = await import("@/app/equipe/financeiro/page");
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("Financeiro: interface e relatório privado", () => {
  it("não consulta o relatório quando a autenticação/assinatura é recusada", async () => {
    mocks.access.mockRejectedValue(new Error("acesso recusado"));
    await expect(
      GET(new Request("https://example.test/equipe/financeiro/relatorio")),
    ).rejects.toThrow("acesso recusado");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejeita filtros inválidos e relatórios excessivos sem truncar dados", async () => {
    mocks.access.mockResolvedValue({ db: {} });
    expect(
      (await GET(new Request("https://example.test/equipe/financeiro/relatorio?from=2026-02-30")))
        .status,
    ).toBe(400);
    mocks.summary.mockResolvedValue({ count: "10001" });
    expect(
      (await GET(new Request("https://example.test/equipe/financeiro/relatorio"))).status,
    ).toBe(422);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("exporta valores e conteúdo seguro, com cache privado", async () => {
    mocks.access.mockResolvedValue({ db: {} });
    mocks.summary.mockResolvedValue({ count: "1" });
    mocks.list.mockResolvedValue([
      {
        description: "=CMD()",
        counterparty: "Cliente",
        kind: "receita",
        direction: "receber",
        due_date: "2026-01-01",
        amount_cents: "12345",
        paid_cents: "345",
        balance_cents: "12000",
        status: "aberto",
        protocol: "JO-1",
        installment_number: 1,
        installment_count: 1,
        notes: "Manual",
      },
    ]);
    const response = await GET(new Request("https://example.test/equipe/financeiro/relatorio"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const text = await response.text();
    expect(text).toContain("123.45");
    expect(text).toContain("'=CMD()");
  });
  it("renderiza formulário rotulado, filtros, caixa e estado vazio", async () => {
    mocks.access.mockResolvedValue({ db: {}, actor: "adv", role: "lawyer" });
    mocks.summary.mockResolvedValue({ receivable: "0", payable: "0", overdue: "0", count: "0" });
    mocks.list.mockResolvedValue([]);
    mocks.cash.mockResolvedValue([]);
    mocks.history.mockResolvedValue([]);
    mocks.options.mockResolvedValue({ cases: [], installments: [] });
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: "Financeiro" })).toBeInTheDocument();
    expect(screen.getByLabelText("Cliente / favorecido")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exportar relatório CSV" })).toHaveAttribute(
      "href",
      "/equipe/financeiro/relatorio?",
    );
    expect(screen.getByText("Nenhum registro neste filtro.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fluxo de caixa" })).toBeInTheDocument();
  });
});
