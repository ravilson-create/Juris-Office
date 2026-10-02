import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import type { CaseStatus } from "@/domain/case/schema";
import { resumirContagemPorStatus } from "@/domain/case/dashboard";
import { calcularPaginacao, TAMANHO_PAGINA_EQUIPE } from "@/domain/case/listagem";
import {
  CASE_STATUS_LABEL,
  STATUS_PROFISSIONAL,
  statusProfissionalValido,
} from "@/domain/case/status";
import { contarCasosPorStatus, contarCasosSemAdvogado } from "@/lib/services/equipe-dashboard";
import { contarCasosFila, listarCasosFila } from "@/lib/services/equipe-fila";
import { contarPrazosVencidos, listarPrazosProximos } from "@/lib/services/equipe-prazos";
import { assignLawyer } from "./actions";

const DIAS_ALERTA_PRAZO = 7;

export const dynamic = "force-dynamic";
export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string; pagina?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const profile = await db.query<{ role: string; office_id: string }>(
    "SELECT role, office_id FROM profiles WHERE user_id = $1",
    [actor],
  );
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) redirect("/atendimento/meus");
  if (profile[0].role === "lawyer") {
    const active = await db.query(
      "SELECT 1 FROM lawyer_subscriptions WHERE lawyer_id = $1 AND status IN ('active', 'trial') AND valid_until > now()",
      [actor],
    );
    if (!active.length) redirect("/assinatura");
    const oab = await db.query<{ oab_verificado_em: Date | null }>(
      "SELECT oab_verificado_em FROM profiles WHERE user_id = $1",
      [actor],
    );
    if (!oab[0]?.oab_verificado_em) redirect("/advogado/pendente");
  }
  const { busca, status: statusBruto, pagina: paginaBruta } = await searchParams;
  const query = (busca ?? "").trim().slice(0, 80);
  const status = statusProfissionalValido(statusBruto);
  const filtro = { status, busca: query };

  const totalFiltrado = await contarCasosFila(db, filtro);
  const { pagina, totalPaginas, offset } = calcularPaginacao(
    totalFiltrado,
    Number(paginaBruta ?? 1),
  );
  const cases = await listarCasosFila(db, filtro, TAMANHO_PAGINA_EQUIPE, offset);

  const resumo = resumirContagemPorStatus(await contarCasosPorStatus(db));
  const semAdvogado =
    profile[0].role === "admin" ? await contarCasosSemAdvogado(db) : 0;
  const prazosProximos = await listarPrazosProximos(db, DIAS_ALERTA_PRAZO);
  const prazosVencidos = await contarPrazosVencidos(db);
  const hojeISO = new Date().toISOString().slice(0, 10);
  const lawyers =
    profile[0].role === "admin"
      ? await db.query<{ user_id: string }>(
          `SELECT p.user_id FROM profiles p JOIN lawyer_subscriptions s ON s.lawyer_id = p.user_id
           WHERE p.role = 'lawyer' AND p.office_id = $1 AND s.status IN ('active', 'trial')
             AND s.valid_until > now() AND p.oab_verificado_em IS NOT NULL ORDER BY p.user_id`,
          [profile[0].office_id],
        )
      : [];
  const pendentesOab =
    profile[0].role === "admin"
      ? await db.query<{ count: string }>(
          `SELECT count(*) FROM profiles
           WHERE role = 'lawyer' AND office_id = $1 AND oab_numero IS NOT NULL
             AND oab_verificado_em IS NULL`,
          [profile[0].office_id],
        )
      : [];
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl">Área profissional</h1>
        <div className="flex gap-4">
          {profile[0].role === "admin" && (
            <>
              <Link href="/equipe/time" className="text-sm text-navy hover:underline">
                Gestão de equipe →
              </Link>
              <Link href="/equipe/auditoria" className="text-sm text-navy hover:underline">
                Auditoria de acesso →
              </Link>
            </>
          )}
          <Link href="/equipe/consultas" className="text-sm text-navy hover:underline">
            Consultas externas →
          </Link>
        </div>
      </div>
      <p className="mt-2 text-muted">
        {profile[0].role === "admin" ? "Casos do seu escritório" : "Casos atribuídos a você"}
      </p>

      <div className="mt-6 flex flex-wrap gap-3" aria-label="Resumo por status">
        <Link
          href="/equipe"
          className={`rounded-md border px-4 py-3 ${status === null ? "border-navy" : "border-line"} bg-surface`}
        >
          <p className="text-2xl font-semibold">{resumo.total}</p>
          <p className="text-sm text-muted">Total</p>
        </Link>
        {resumo.porStatus
          .filter((item) => item.total > 0)
          .map((item) => (
            <Link
              key={item.status}
              href={`/equipe?status=${item.status}`}
              className={`rounded-md border px-4 py-3 ${status === item.status ? "border-navy" : "border-line"} bg-surface`}
            >
              <p className="text-2xl font-semibold">{item.total}</p>
              <p className="text-sm text-muted">{item.label}</p>
            </Link>
          ))}
      </div>

      {profile[0].role === "admin" && semAdvogado > 0 && (
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

      {profile[0].role === "admin" && Number(pendentesOab[0]?.count ?? 0) > 0 && (
        <Link
          href="/equipe/pendentes"
          className="mt-4 block rounded-md border border-line bg-surface p-4 underline"
        >
          {pendentesOab[0].count} advogado(s) aguardando confirmação da OAB
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
        <button className="rounded bg-navy px-4 text-white">Buscar</button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {totalFiltrado} caso(s) · página {pagina} de {totalPaginas}
      </p>
      <ul className="mt-4 space-y-4">
        {cases.map((item) => (
          <li key={item.id} className="rounded border p-5">
            <Link className="font-semibold underline" href={`/equipe/${item.id}`}>
              {item.protocol}
            </Link>
            <p className="text-sm">
              {item.title || "Caso sem título"} ·{" "}
              {CASE_STATUS_LABEL[item.status as CaseStatus] ?? item.status}
            </p>
            {profile[0].role === "admin" && lawyers.length > 0 && (
              <form action={assignLawyer} className="mt-4 flex gap-2">
                <input type="hidden" name="caseId" value={item.id} />
                <label>
                  Advogado{" "}
                  <select name="lawyerId" className="rounded border p-2">
                    {lawyers.map((lawyer) => (
                      <option value={lawyer.user_id} key={lawyer.user_id}>
                        {lawyer.user_id}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="rounded bg-navy px-3 text-white">Atribuir</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {cases.length === 0 && <p className="mt-6">Nenhum caso disponível.</p>}
      {totalPaginas > 1 && (
        <nav className="mt-6 flex items-center justify-between" aria-label="Paginação">
          <Link
            href={linkPagina(query, status, pagina - 1)}
            aria-disabled={pagina <= 1}
            className={`rounded border px-3 py-2 ${pagina <= 1 ? "pointer-events-none text-muted" : "underline"}`}
          >
            ← Anterior
          </Link>
          <span className="text-sm text-muted">
            Página {pagina} de {totalPaginas}
          </span>
          <Link
            href={linkPagina(query, status, pagina + 1)}
            aria-disabled={pagina >= totalPaginas}
            className={`rounded border px-3 py-2 ${pagina >= totalPaginas ? "pointer-events-none text-muted" : "underline"}`}
          >
            Próxima →
          </Link>
        </nav>
      )}
    </main>
  );
}

function linkPagina(busca: string, status: CaseStatus | null, pagina: number): string {
  const params = new URLSearchParams();
  if (busca) params.set("busca", busca);
  if (status) params.set("status", status);
  if (pagina > 1) params.set("pagina", String(pagina));
  const query = params.toString();
  return query ? `/equipe?${query}` : "/equipe";
}
