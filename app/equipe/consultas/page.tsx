import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import {
  consultarProcessoDatajud,
  datajudConfigurado,
  type ProcessoDatajud,
} from "@/lib/external/datajud";
import {
  SERVICOS_JURISPRUDENCIA,
  SERVICOS_PROCESSUAIS,
  SERVICO_DOU,
  TERMO_POR_AREA,
} from "@/lib/external/consultas";
import { legalAreaSlugSchema, type LegalAreaSlug } from "@/domain/legal-area/schema";

export const dynamic = "force-dynamic";

const AREAS: { slug: LegalAreaSlug; nome: string }[] = [
  { slug: "consumidor", nome: "Consumidor" },
  { slug: "trabalhista", nome: "Trabalhista" },
  { slug: "familia", nome: "Família" },
  { slug: "previdenciario", nome: "Previdenciário" },
  { slug: "civel", nome: "Cível" },
];

function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}

/**
 * Tela independente de qualquer atendimento/caso — fica numa aba própria da área
 * profissional. Nenhum dado de cidadão passa por aqui: o advogado digita o que precisar
 * pesquisar (número de processo, área jurídica genérica) com suas próprias credenciais.
 */
export default async function ConsultasExternasPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string; tribunal?: string; area?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");

  const db = getDb();
  const profile = await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = $1", [
    actor,
  ]);
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) redirect("/atendimento/meus");
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

  const { numero, tribunal, area: areaRaw } = await searchParams;
  const area = legalAreaSlugSchema.safeParse(areaRaw).data;

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
      <h1 className="text-3xl">Consultas externas</h1>
      <p className="mt-2 max-w-prose text-muted">
        Fica fora do atendimento de qualquer caso: nenhum dado de cidadão é enviado
        automaticamente a estes sites. Você decide o que pesquisar em cada um, com suas próprias
        credenciais quando for o caso.
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
                className="mt-3 inline-block rounded border border-line px-3 py-1.5 text-sm font-medium text-navy hover:border-navy"
              >
                Abrir {s.nome} ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="jurisprudencia-title">
        <h2 id="jurisprudencia-title" className="text-xl">
          Jurisprudência, legislação e Diário Oficial
        </h2>
        <form className="mt-3 flex flex-wrap items-end gap-3">
          {numero && <input type="hidden" name="numero" value={numero} />}
          {tribunal && <input type="hidden" name="tribunal" value={tribunal} />}
          <div>
            <label htmlFor="area" className="block text-sm font-medium">
              Área jurídica (opcional, para pré-preencher a busca)
            </label>
            <select
              id="area"
              name="area"
              defaultValue={area ?? ""}
              className="mt-1 w-56 rounded border border-line p-2"
            >
              <option value="">Sem área — abre a busca em branco</option>
              {AREAS.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.nome} ({TERMO_POR_AREA[a.slug]})
                </option>
              ))}
            </select>
          </div>
          <button className="rounded border border-line px-4 py-2">Aplicar</button>
        </form>

        <ul className="mt-4 space-y-3">
          {SERVICOS_JURISPRUDENCIA.map((s) => (
            <li key={s.id} className="rounded-md border border-line p-4">
              <p className="font-semibold">{s.nome}</p>
              <p className="mt-1 text-sm text-muted">{s.descricao}</p>
              <p className="mt-1 text-sm text-muted">{s.motivoSemIntegracao}</p>
              <a
                href={s.url(area)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded border border-line px-3 py-1.5 text-sm font-medium text-navy hover:border-navy"
              >
                Abrir {s.nome} ↗
              </a>
            </li>
          ))}
          <li className="rounded-md border border-line p-4">
            <p className="font-semibold">{SERVICO_DOU.nome}</p>
            <p className="mt-1 text-sm text-muted">{SERVICO_DOU.descricao}</p>
            <p className="mt-1 text-sm text-muted">{SERVICO_DOU.motivoSemIntegracao}</p>
            <a
              href={SERVICO_DOU.url(area)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded border border-line px-3 py-1.5 text-sm font-medium text-navy hover:border-navy"
            >
              Abrir {SERVICO_DOU.nome} ↗
            </a>
          </li>
        </ul>
      </section>
    </main>
  );
}
