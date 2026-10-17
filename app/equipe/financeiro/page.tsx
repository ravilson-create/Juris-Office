import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireFinancialAccess } from "@/lib/auth/financeiro-acesso";
import { financialKinds } from "@/domain/financeiro/schema";
import {
  financeFilters,
  financialCashFlow,
  financialHistory,
  financialOptions,
  financialSummary,
  listFinancialEntries,
} from "@/lib/services/financeiro";
import { formatCents } from "@/domain/triage/money";
import { businessDate } from "@/domain/time";
import { FinancialForm, PrintReport, fieldClass } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro do escritório" };
const money = (n: string | number) => formatCents(Number(n));
const date = (s: string) => s.split("-").reverse().join("/");
const statusLabel = {
  aberto: "Em aberto",
  quitado: "Quitado",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

export default async function FinancialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db, actor, role } = await requireFinancialAccess();
  const params = await searchParams;
  const raw = Object.fromEntries(
    Object.entries(params).filter(([, v]) => typeof v === "string" && v !== ""),
  );
  const parsed = financeFilters.safeParse(raw);
  const filters = parsed.success ? parsed.data : {};
  const page = Math.min(100000, Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1));
  const today = businessDate(new Date());
  const year = today.slice(0, 4);
  const [rows, totals, cash, options] = await Promise.all([
    listFinancialEntries(db, filters, page),
    financialSummary(db, filters),
    financialCashFlow(db, filters.from ?? `${year}-01-01`, filters.to ?? `${year}-12-31`),
    financialOptions(db),
  ]);
  const history = await financialHistory(
    db,
    rows.map((r) => r.id),
  );
  const query = new URLSearchParams(Object.entries(filters));
  const pageLink = (n: number) => {
    const q = new URLSearchParams(query);
    q.set("page", String(n));
    return `?${q}`;
  };
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl">Financeiro</h1>
      {role === "admin" && <Link href="/equipe/financeiro/pessoal" className="mt-4 inline-flex rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-navy hover:underline">Pessoal e folha de pagamento →</Link>}
      <p className="mt-2 text-muted">
        Controle interno do escritório. Registre manualmente honorários, receitas, despesas,
        repasses e acertos.
      </p>
      <p className="mt-1 text-sm text-muted">
        As baixas informam o que já foi recebido ou pago. A assinatura da plataforma continua em
        Minha assinatura.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["A receber", totals.receivable],
          ["A pagar", totals.payable],
          ["Recebimentos vencidos", totals.overdue],
        ].map(([label, value]) => (
          <section key={label} className="rounded-lg border border-line bg-surface p-5">
            <h2 className="text-sm text-muted">{label}</h2>
            <p className="mt-2 text-2xl font-semibold text-navy">{money(value)}</p>
          </section>
        ))}
      </div>
      <section
        className="mt-8 rounded-lg border border-line bg-surface p-5 print:hidden"
        aria-labelledby="novo-financeiro"
      >
        <details>
          <summary id="novo-financeiro" className="cursor-pointer text-lg font-semibold">
            Novo lançamento manual
          </summary>
          <div className="mt-4">
            <FinancialForm label="Registrar lançamento">
              <input type="hidden" name="operation" value="create" />
              <input type="hidden" name="requestId" value={randomUUID()} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label>
                  Descrição
                  <input
                    required
                    name="description"
                    minLength={2}
                    maxLength={240}
                    className={fieldClass}
                  />
                </label>
                <label>
                  Cliente / favorecido
                  <input
                    required
                    name="counterparty"
                    minLength={2}
                    maxLength={160}
                    className={fieldClass}
                  />
                </label>
                <label>
                  Categoria
                  <select name="kind" className={fieldClass}>
                    {Object.entries(financialKinds).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Movimento
                  <select name="direction" className={fieldClass}>
                    <option value="receber">Conta a receber</option>
                    <option value="pagar">Conta a pagar</option>
                  </select>
                </label>
                <label>
                  Valor total (R$)
                  <input
                    required
                    name="amount"
                    inputMode="decimal"
                    placeholder="1250,50"
                    className={fieldClass}
                  />
                </label>
                <label>
                  Primeiro vencimento
                  <input
                    required
                    name="dueDate"
                    type="date"
                    defaultValue={today}
                    className={fieldClass}
                  />
                </label>
                <label>
                  Número de parcelas mensais
                  <input
                    required
                    name="installments"
                    type="number"
                    min={1}
                    max={120}
                    defaultValue={1}
                    className={fieldClass}
                  />
                </label>
                <label>
                  Cliente e processo / atendimento
                  <select name="caseId" className={fieldClass}>
                    <option value="">Sem vínculo com atendimento</option>
                    {options.cases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.protocol} · {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Observações
                  <textarea name="notes" maxLength={2000} className={fieldClass} />
                </label>
              </div>
              <p className="text-xs text-muted">
                Honorários: a receber. Despesas e repasses: a pagar. O total é distribuído entre as
                parcelas; finais de mês são ajustados ao último dia disponível.
              </p>
            </FinancialForm>
          </div>
        </details>
      </section>
      {options.installments.length > 0 && (
        <section className="mt-4 rounded-lg border border-line bg-surface p-5 print:hidden">
          <details>
            <summary className="cursor-pointer font-semibold">
              Registrar parcela de contrato existente
            </summary>
            <div className="mt-4">
              <FinancialForm label="Trazer parcela ao Financeiro">
                <input type="hidden" name="operation" value="import" />
                <label>
                  Parcela pendente
                  <select name="installmentId" required className={fieldClass}>
                    {options.installments.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.protocol} · {date(i.due_date)} · {money(i.amount_cents)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-muted">
                  Cada parcela pode ser trazida uma única vez. Baixas no Financeiro não alteram o
                  contrato. Parcelas já pagas devem ser registradas manualmente com a data efetiva
                  do recebimento.
                </p>
              </FinancialForm>
            </div>
          </details>
        </section>
      )}

      <section className="mt-8" aria-labelledby="contas-financeiro">
        <h2 id="contas-financeiro" className="text-xl">
          Contas e relatórios
        </h2>
        <form className="mt-4 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3 print:hidden">
          <label>
            Vencimento de
            <input type="date" name="from" defaultValue={filters.from} className={fieldClass} />
          </label>
          <label>
            Até
            <input type="date" name="to" defaultValue={filters.to} className={fieldClass} />
          </label>
          <label>
            Movimento
            <select name="direction" defaultValue={filters.direction ?? ""} className={fieldClass}>
              <option value="">Todos</option>
              <option value="receber">A receber</option>
              <option value="pagar">A pagar</option>
            </select>
          </label>
          <label>
            Categoria
            <select name="kind" defaultValue={filters.kind ?? ""} className={fieldClass}>
              <option value="">Todas</option>
              {Object.entries(financialKinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Situação
            <select name="status" defaultValue={filters.status ?? ""} className={fieldClass}>
              <option value="">Todas</option>
              {Object.entries(statusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Atendimento
            <select name="caseId" defaultValue={filters.caseId ?? ""} className={fieldClass}>
              <option value="">Todos</option>
              {options.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.protocol} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button className="rounded bg-navy px-4 py-2 text-white">Filtrar</button>
            <Link href="/equipe/financeiro">Limpar</Link>
          </div>
        </form>
        {!parsed.success && (
          <p role="alert" className="mt-3 text-danger">
            Filtro inválido. Exibindo todos os registros permitidos.
          </p>
        )}
        <div className="my-4 flex flex-wrap items-center gap-4 print:hidden">
          <Link
            className="font-semibold text-navy underline"
            href={`/equipe/financeiro/relatorio?${query}`}
          >
            Exportar relatório CSV
          </Link>
          <PrintReport />
          <span className="text-sm text-muted">
            {totals.count} registros · página {page}
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-line bg-paper">
              <tr>
                {["Registro", "Vencimento", "Valor", "Baixado", "Saldo", "Situação", "Ações"].map(
                  (h) => (
                    <th scope="col" key={h} className="p-3">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="p-3">
                    <p className="font-semibold">{r.description}</p>
                    <p>{r.counterparty}</p>
                    <p className="text-xs text-muted">
                      {financialKinds[r.kind]} ·{" "}
                      {r.direction === "receber" ? "A receber" : "A pagar"} · {r.installment_number}
                      /{r.installment_count}
                    </p>
                    {r.case_id && (
                      <Link className="text-navy underline" href={`/equipe/${r.case_id}`}>
                        {r.protocol}
                      </Link>
                    )}
                    {r.notes && <p className="max-w-xs text-xs text-muted">{r.notes}</p>}
                    {history.some((h) => h.entry_id === r.id) && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-navy">Histórico de baixas</summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {history
                            .filter((h) => h.entry_id === r.id)
                            .map((h) => (
                              <li key={h.id}>
                                {date(h.paid_on)} · {money(h.amount_cents)}
                                {h.note && ` · ${h.note}`}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="p-3">{date(r.due_date)}</td>
                  <td className="p-3 whitespace-nowrap">{money(r.amount_cents)}</td>
                  <td className="p-3 whitespace-nowrap">{money(r.paid_cents)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {r.status === "cancelado" ? "—" : money(r.balance_cents)}
                  </td>
                  <td className="p-3">{statusLabel[r.status]}</td>
                  <td className="min-w-48 p-3 print:hidden">
                    {!["quitado", "cancelado"].includes(r.status) && (
                      <details>
                        <summary className="cursor-pointer text-navy">Registrar baixa</summary>
                        <div className="mt-2">
                          <FinancialForm label="Confirmar baixa">
                            <input type="hidden" name="operation" value="settle" />
                            <input type="hidden" name="entryId" value={r.id} />
                            <input type="hidden" name="requestId" value={randomUUID()} />
                            <label>
                              Valor (R$)
                              <input
                                required
                                name="amount"
                                inputMode="decimal"
                                defaultValue={(Number(r.balance_cents) / 100).toFixed(2)}
                                className={fieldClass}
                              />
                            </label>
                            <label>
                              Data efetiva
                              <input
                                required
                                type="date"
                                name="paidOn"
                                max={today}
                                defaultValue={today}
                                className={fieldClass}
                              />
                            </label>
                            <label>
                              Observação
                              <input name="note" maxLength={1000} className={fieldClass} />
                            </label>
                          </FinancialForm>
                        </div>
                      </details>
                    )}
                    {Number(r.paid_cents) === 0 &&
                      r.status !== "cancelado" &&
                      (role === "admin" || (role === "lawyer" && r.created_by === actor)) && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-danger">Cancelar</summary>
                          <p className="my-2 text-xs">
                            Confirme para retirar a conta dos saldos. O histórico será preservado.
                          </p>
                          <FinancialForm label="Confirmar cancelamento">
                            <input type="hidden" name="operation" value="cancel" />
                            <input type="hidden" name="entryId" value={r.id} />
                          </FinancialForm>
                        </details>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-muted">Nenhum registro neste filtro.</p>}
        </div>
        <nav aria-label="Páginas do Financeiro" className="mt-4 flex gap-4 print:hidden">
          {page > 1 && <Link href={pageLink(page - 1)}>Anterior</Link>}
          {page * 30 < Number(totals.count) && <Link href={pageLink(page + 1)}>Próxima</Link>}
        </nav>
      </section>
      <section className="mt-10" aria-labelledby="caixa-financeiro">
        <h2 id="caixa-financeiro" className="text-xl">
          Fluxo de caixa
        </h2>
        <p className="mt-2 text-sm text-muted">
          Período: {date(filters.from ?? `${year}-01-01`)} a {date(filters.to ?? `${year}-12-31`)}.
          Considera todos os movimentos permitidos ao seu perfil. Realizado por data da baixa;
          previsão por vencimento. Saldo líquido do período, sem saldo bancário inicial.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[660px] text-left text-sm">
            <thead>
              <tr>
                {["Mês", "Recebido", "Pago", "Líquido realizado", "A receber", "A pagar"].map(
                  (h) => (
                    <th key={h} scope="col" className="p-3">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {cash.map((c) => (
                <tr key={c.month} className="border-t border-line">
                  <th scope="row" className="p-3">
                    {c.month}
                  </th>
                  <td className="p-3">{money(c.received)}</td>
                  <td className="p-3">{money(c.paid)}</td>
                  <td className="p-3">{money(Number(c.received) - Number(c.paid))}</td>
                  <td className="p-3">{money(c.expected_in)}</td>
                  <td className="p-3">{money(c.expected_out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!cash.length && <p className="p-5 text-muted">Nenhum movimento no período.</p>}
        </div>
      </section>
    </main>
  );
}
