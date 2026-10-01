import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import {
  consultarProcessoDatajud,
  datajudConfigurado,
  type ProcessoDatajud,
} from "@/lib/external/datajud";
import { SERVICOS_JURISPRUDENCIA, SERVICOS_PROCESSUAIS, SERVICO_DOU } from "@/lib/external/consultas";

export const dynamic = "force-dynamic";

function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}

export default async function ConsultasPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ numero?: string; tribunal?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();

  const db = getDb();
  const profile = await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = $1", [
    actor,
  ]);
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) notFound();
  if (profile[0].role === "lawyer") {
    const acesso = await db.query<{ oab_verificado_em: Date | null }>(
      `SELECT p.oab_verificado_em FROM profiles p
       JOIN lawyer_subscriptions s ON s.lawyer_id = p.user_id
       WHERE p.user_id = $1 AND s.status IN ('active', 'trial') AND s.valid_until > now()`,
      [actor],
    );
    if (!acesso.length) redirect("/assinatura");
    if (!acesso[0].oab_verificado_em) redirect("/advogado/pendente");
  }

  // A política RLS é o filtro definitivo: um caseId de outro escritório/sem atribuição não acha nada.
  const ctx = await getCaseService().getTriageContext(caseId);
  if (!ctx) notFound();

  const { numero, tribunal } = await searchParams;
  let processo: ProcessoDatajud | null = null;
  let erroConsulta: string | null = null;
  if (numero && tribunal) {
    try {
      processo = await consultarProcessoDatajud(tribunal, numero);
    } catch (e) {
      erroConsulta = e instanceof Error ? e.message : "Falha ao consultar o DataJud.";
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p>
        <Link href={`/equipe/${caseId}`}>Voltar ao caso</Link>
      </p>
      <h1 className="mt-4 text-3xl">Consultas externas</h1>
      <p className="mt-2 max-w-prose text-muted">
        {ctx.area.name} — {ctx.legalCase.applicant?.fullName ?? "sem identificação"}. Nenhum dado
        deste caso é enviado automaticamente aos sites abaixo: você decide o que pesquisar em
        cada um, com suas próprias credenciais quando for o caso.
      </p>

      <section className="mt-8" aria-labelledby="processo-title">
        <h2 id="processo-title" className="text-xl">
          Processo no CNJ
        </h2>
        <p className="mt-2 text-sm text-muted">
          A API Pública do DataJud (CNJ) devolve as movimentações de um processo já protocolado,
          sem precisar de certificado digital — basta o número do processo e a sigla do tribunal
          (ex.: <code>tjsp</code>, <code>trf1</code>, <code>tst</code>, <code>tjma</code>).
        </p>

        {datajudConfigurado() ? (
          <form className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="numero" className="block text-sm font-medium">
                Número do processo (CNJ)
              </label>
              <input
                id="numero"
                name="numero"
                defaultValue={numero}
                placeholder="0000000-00.0000.0.00.0000"
                required
                className="mt-1 w-64 rounded border border-line p-2"
              />
            </div>
            <div>
              <label htmlFor="tribunal" className="block text-sm font-medium">
                Sigla do tribunal
              </label>
              <input
                id="tribunal"
                name="tribunal"
                defaultValue={tribunal}
                placeholder="tjsp"
                required
                className="mt-1 w-32 rounded border border-line p-2"
              />
            </div>
            <button className="rounded bg-navy px-4 py-2 text-white">Consultar</button>
          </form>
        ) : (
          <div className="mt-4">
            <Alert title="Consulta automática indisponível nesta instalação">
              Falta configurar a variável <code>DATAJUD_API_KEY</code> (veja{" "}
              <a
                href="https://datajud-wiki.cnj.jus.br"
                className="text-navy hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                datajud-wiki.cnj.jus.br
              </a>
              ).
            </Alert>
          </div>
        )}

        {erroConsulta && (
          <div className="mt-4">
            <Alert tone="error" title="Não foi possível consultar.">
              {erroConsulta}
            </Alert>
          </div>
        )}

        {numero && tribunal && !erroConsulta && !processo && (
          <div className="mt-4">
            <Alert title="Nenhum processo encontrado.">
              Confira o número e a sigla do tribunal — alguns processos em segredo de justiça não
              aparecem na consulta pública.
            </Alert>
          </div>
        )}

        {processo && (
          <div className="mt-4 rounded-md border border-line bg-surface p-4">
            <p className="font-semibold">{processo.numeroProcesso}</p>
            <p className="mt-1 text-sm text-muted">
              {processo.classe ?? "Classe não informada"} ·{" "}
              {processo.orgaoJulgador ?? "Órgão julgador não informado"}
            </p>
            <p className="mt-1 text-sm text-muted">
              Ajuizado em {formatarDataHora(processo.dataAjuizamento)}
            </p>
            <h3 className="mt-4 font-semibold">Movimentações</h3>
            {processo.movimentos.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Sem movimentações registradas.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {processo.movimentos.map((m, i) => (
                  <li key={i} className="border-l-2 border-line pl-3">
                    <span className="text-muted">{formatarDataHora(m.dataHora)}</span> —{" "}
                    {m.nome ?? "Movimento sem descrição"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {SERVICOS_PROCESSUAIS.map((s) => (
            <li key={s.id} className="rounded-md border border-line p-4">
              <p className="font-semibold">{s.nome}</p>
              <p className="mt-1 text-sm text-muted">{s.descricao}</p>
              <p className="mt-1 text-sm text-muted">{s.motivoSemIntegracao}</p>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-navy hover:underline"
              >
                Abrir {s.nome} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="jurisprudencia-title">
        <h2 id="jurisprudencia-title" className="text-xl">
          Jurisprudência e legislação
        </h2>
        <ul className="mt-4 space-y-3">
          {SERVICOS_JURISPRUDENCIA.map((s) => (
            <li key={s.id} className="rounded-md border border-line p-4">
              <p className="font-semibold">{s.nome}</p>
              <p className="mt-1 text-sm text-muted">{s.descricao}</p>
              <p className="mt-1 text-sm text-muted">{s.motivoSemIntegracao}</p>
              <a
                href={s.url(ctx.area.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-navy hover:underline"
              >
                Buscar {ctx.area.name.toLowerCase()} no {s.nome} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="dou-title">
        <h2 id="dou-title" className="text-xl">
          Diário Oficial
        </h2>
        <div className="mt-4 rounded-md border border-line p-4">
          <p className="font-semibold">{SERVICO_DOU.nome}</p>
          <p className="mt-1 text-sm text-muted">{SERVICO_DOU.descricao}</p>
          <p className="mt-1 text-sm text-muted">{SERVICO_DOU.motivoSemIntegracao}</p>
          <a
            href={SERVICO_DOU.url(ctx.area.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-navy hover:underline"
          >
            Buscar no e-DOU ↗
          </a>
        </div>
      </section>
    </main>
  );
}
