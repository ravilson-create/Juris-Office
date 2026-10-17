import { requireFinancialAccess } from "@/lib/auth/financeiro-acesso";
import { financeFilters, financialSummary, listFinancialEntries } from "@/lib/services/financeiro";
import { csvCell, financialKinds } from "@/domain/financeiro/schema";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { db } = await requireFinancialAccess();
  const parsed = financeFilters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!parsed.success) return new Response("Filtros inválidos.", { status: 400, headers });
  const summary = await financialSummary(db, parsed.data);
  if (Number(summary.count) > 10000)
    return new Response("Mais de 10.000 registros. Reduza o período do relatório.", {
      status: 422,
      headers,
    });
  const rows = await listFinancialEntries(db, parsed.data, 1, 10000);
  const table = [
    [
      "Descrição",
      "Cliente / favorecido",
      "Categoria",
      "Movimento",
      "Vencimento",
      "Valor R$",
      "Baixado R$",
      "Saldo R$",
      "Situação",
      "Protocolo",
      "Parcela",
      "Observações",
    ],
    ...rows.map((r) => [
      r.description,
      r.counterparty,
      financialKinds[r.kind],
      r.direction,
      r.due_date,
      (Number(r.amount_cents) / 100).toFixed(2),
      (Number(r.paid_cents) / 100).toFixed(2),
      r.status === "cancelado" ? "0.00" : (Number(r.balance_cents) / 100).toFixed(2),
      r.status,
      r.protocol ?? "",
      `${r.installment_number}/${r.installment_count}`,
      r.notes,
    ]),
  ];
  return new Response("\uFEFF" + table.map((r) => r.map(csvCell).join(";")).join("\r\n"), {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="financeiro.csv"',
    },
  });
}
