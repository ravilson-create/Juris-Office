import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { acessoEquipe } from "@/lib/auth/equipe-acesso";
import type { CaseStatus } from "@/domain/case/schema";
import { resumirContagemPorStatus } from "@/domain/case/dashboard";
import { calcularPaginacao, TAMANHO_PAGINA_EQUIPE } from "@/domain/case/listagem";
import {
  CASE_STATUS_LABEL,
  STATUS_PROFISSIONAL,
  statusProfissionalValido,
} from "@/domain/case/status";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { contarCasosPorStatus, contarCasosSemAdvogado } from "@/lib/services/equipe-dashboard";
import { contarCasosFila, listarCasosFila } from "@/lib/services/equipe-fila";
import { contarPrazosVencidos, listarPrazosProximos } from "@/lib/services/equipe-prazos";
import { assignLawyer } from "./actions";

const DIAS_ALERTA_PRAZO = 7;

const NOME_AREA = new Map(LEGAL_AREAS.map((a) => [a.id, a.name]));

/** Painel do topo mostra só estas três, sempre com a contagem (mesmo zero) — as demais famílias
 * de status (rascunho/triagem, recusado, em negociação, em andamento, encerrado) continuam
 * filtráveis pelo seletor de busca abaixo, só não ganham um cartão dedicado. */
const STATUS_DASHBOARD: readonly CaseStatus[] = ["under_legal_review", "needs_information", "accepted"];

/**
 * Uma cor por "família" de status, não um tom por status — famílias com significado diferente
 * (aguardando decisão vs. aceito vs. recusado) precisam ser discrimináveis, mas variar a cor
 * dentro da mesma família (ex.: draft vs. submitted) só acrescentaria ruído.
 */
const ESTILO_STATUS: Record<CaseStatus, string> = {
  draft: "bg-paper text-muted",
  triage: "bg-paper text-muted",
  awaiting_documents: "bg-paper text-muted",
  ready_for_review: "bg-paper text-muted",
  submitted: "bg-navy-soft text-navy-strong",
  under_legal_review: "bg-navy-soft text-navy-strong",
  needs_information: "bg-gold-soft text-gold-strong",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-danger-soft text-danger",
  in_negotiation: "bg-violet-50 text-violet-700",
  active: "bg-emerald-50 text-emerald-700",
  closed: "bg-paper text-muted",
};

export const dynamic = "force-dynamic";
export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string; pagina?: string; arquivados?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const acesso = await acessoEquipe(db, actor);
  if (!acesso.ok) redirect(acesso.motivo === "sem_papel" ? "/atendimento/meus" : "/assinatura");
  const profile = { role: acesso.role, office_id: acesso.officeId };
  const { busca, status: statusBruto, pagina: paginaBruta, arquivados: arquivadosBruto } =
    await searchParams;
  const query = (busca ?? "").trim().slice(0, 80);
  const status = statusProfissionalValido(statusBruto);
  const arquivados = arquivadosBruto === "1";
  const filtro = { status, busca: query, arquivados };

  const totalFiltrado = await contarCasosFila(db, filtro);
  const { pagina, totalPaginas, offset } = calcularPaginacao(
    totalFiltrado,
    Number(paginaBruta ?? 1),
  );
  const cases = await listarCasosFila(db, filtro, TAMANHO_PAGINA_EQUIPE, offset);

  const visaoEscritorio = profile.role !== "lawyer";
  const podeAtribuir = profile.role === "admin";
  const resumo = resumirContagemPorStatus(await contarCasosPorStatus(db));
  const semAdvogado = visaoEscritorio ? await contarCasosSemAdvogado(db) : 0;
  const prazosProximos = await listarPrazosProximos(db, DIAS_ALERTA_PRAZO);
  const prazosVencidos = await contarPrazosVencidos(db);
  const hojeISO = new Date().toISOString().slice(0, 10);
  // A assinatura é do escritório (acessoEquipe já confirmou que está em dia), não mais de cada
  // advogado — por isso não há mais join com lawyer_subscriptions aqui.
  const lawyers = podeAtribuir
    ? await db.query<{ user_id: string }>(
        `SELECT user_id FROM profiles
         WHERE role = 'lawyer' AND office_id = $1 AND oab_verificado_em IS NOT NULL
         ORDER BY user_id`,
        [profile.office_id],
      )
    : [];
  const pendentesOab = podeAtribuir
    ? await db.query<{ count: string }>(
        `SELECT count(*) FROM profiles
         WHERE role = 'lawyer' AND office_id = $1 AND oab_numero IS NOT NULL
           AND oab_verificado_em IS NULL`,
        [profile.office_id],
      )
    : [];
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl">Área profissional</h1>
      <p className="mt-2 text-muted">
        {visaoEscritorio ? "Casos do seu escritório" : "Casos atribuídos a você"}
      </p>

      <div
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        aria-label="Resumo por status"
      >
        <Link
          href="/equipe"
          className={`rounded-lg border bg-surface p-4 transition-colors hover:border-navy ${status === null ? "border-navy ring-1 ring-navy" : "border-line"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{resumo.total}</p>
        </Link>
        {resumo.porStatus
          .filter((item) => STATUS_DASHBOARD.includes(item.status))
          .map((item) => (
            <Link
              key={item.status}
              href={`/equipe?status=${item.status}`}
              className={`rounded-lg border bg-surface p-4 transition-colors hover:border-navy ${status === item.status ? "border-navy ring-1 ring-navy" : "border-line"}`}
            >
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
                {item.label}
              </p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{item.total}</p>
            </Link>
          ))}
      </div>

      {visaoEscritorio && semAdvogado > 0 && (
        <p className="mt-4 rounded-md border border-line bg-surface p-4">
          <strong>{semAdvogado}</strong> caso(s) do escritório ainda sem advogado atribuído.
        </p>
      )}

      {prazosVencidos > 0 && (
        <p className="mt-4 rounded-md border border-danger bg-danger-soft p-4">
          <strong>{prazosVencidos}</strong> prazo(s) vencido(s) sem conclusão.
        </p>
      )}

      {prazosProximos.length > 0 && (
        <div className="mt-4 rounded-md border border-line bg-surface p-4">
          <p className="font-semibold">
            Prazos nos próximos {DIAS_ALERTA_PRAZO} dias ({prazosProximos.length})
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {prazosProximos.map((p) => (
              <li key={p.id}>
                <Link href={`/equipe/${p.case_id}`} className="text-navy hover:underline">
                  {p.type}
                </Link>{" "}
                — vence em{" "}
                {new Date(p.due_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                {p.due_date <= hojeISO && <strong> (hoje ou atrasado)</strong>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {podeAtribuir && Number(pendentesOab[0]?.count ?? 0) > 0 && (
        <Link
          href="/equipe/pendentes"
          className="mt-4 block rounded-md border border-line bg-surface p-4 font-medium text-navy hover:border-navy"
        >
          {pendentesOab[0].count} advogado(s) aguardando confirmação da OAB →
        </Link>
      )}
      <form action="/equipe" className="mt-6 flex flex-wrap gap-2" role="search">
        <label htmlFor="busca" className="sr-only">
          Buscar caso por protocolo ou título
        </label>
        <input
          id="busca"
          name="busca"
          type="search"
          defaultValue={query}
          placeholder="Protocolo ou título"
          className="min-w-0 flex-1 rounded border p-2"
        />
        <label htmlFor="status" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status ?? ""}
          className="rounded border p-2"
        >
          <option value="">Todos os status</option>
          {STATUS_PROFISSIONAL.map((s) => (
            <option key={s} value={s}>
              {CASE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="arquivados" value="1" defaultChecked={arquivados} />
          Mostrar arquivados
        </label>
        <button className="rounded bg-navy px-4 text-white">Buscar</button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {totalFiltrado} caso{arquivados ? " arquivado" : ""}(s) · página {pagina} de {totalPaginas}
      </p>
      {cases.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3">
                  Protocolo
                </th>
                <th scope="col" className="px-4 py-3">
                  Caso
                </th>
                <th scope="col" className="px-4 py-3">
                  Área
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                {podeAtribuir && lawyers.length > 0 && (
                  <th scope="col" className="px-4 py-3">
                    Atribuir
                  </th>
                )}
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">
                    {item.protocol}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {item.title || "Caso sem título"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {NOME_AREA.get(item.legal_area_id) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        ESTILO_STATUS[item.status as CaseStatus] ?? "bg-paper text-muted"
                      }`}
                    >
                      {CASE_STATUS_LABEL[item.status as CaseStatus] ?? item.status}
                    </span>
                  </td>
                  {podeAtribuir && lawyers.length > 0 && (
                    <td className="px-4 py-3">
                      <form action={assignLawyer} className="flex gap-2">
                        <input type="hidden" name="caseId" value={item.id} />
                        <label className="sr-only" htmlFor={`advogado-${item.id}`}>
                          Advogado para {item.protocol}
                        </label>
                        <select
                          id={`advogado-${item.id}`}
                          name="lawyerId"
                          className="rounded border border-line px-2 py-1 text-xs"
                        >
                          {lawyers.map((lawyer) => (
                            <option value={lawyer.user_id} key={lawyer.user_id}>
                              {lawyer.user_id}
                            </option>
                          ))}
                        </select>
                        <button className="whitespace-nowrap rounded bg-navy px-2.5 py-1 text-xs font-semibold text-white">
                          Atribuir
                        </button>
                      </form>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link href={`/equipe/${item.id}`} className="font-semibold text-navy hover:underline">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cases.length === 0 && <p className="mt-6">Nenhum caso disponível.</p>}
      {totalPaginas > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Paginação">
          <Link
            href={linkPagina(query, status, pagina - 1, arquivados)}
            aria-disabled={pagina <= 1}
            className={`rounded border px-3 py-2 font-medium ${pagina <= 1 ? "pointer-events-none border-line text-muted" : "border-line text-navy hover:border-navy"}`}
          >
            ← Anterior
          </Link>
          <span className="text-sm text-muted">
            Página {pagina} de {totalPaginas}
          </span>
          <Link
            href={linkPagina(query, status, pagina + 1, arquivados)}
            aria-disabled={pagina >= totalPaginas}
            className={`rounded border px-3 py-2 font-medium ${pagina >= totalPaginas ? "pointer-events-none border-line text-muted" : "border-line text-navy hover:border-navy"}`}
          >
            Próxima →
          </Link>
        </nav>
      )}
    </main>
  );
}

function linkPagina(
  busca: string,
  status: CaseStatus | null,
  pagina: number,
  arquivados: boolean,
): string {
  const params = new URLSearchParams();
  if (busca) params.set("busca", busca);
  if (status) params.set("status", status);
  if (pagina > 1) params.set("pagina", String(pagina));
  if (arquivados) params.set("arquivados", "1");
  const query = params.toString();
  return query ? `/equipe?${query}` : "/equipe";
}
