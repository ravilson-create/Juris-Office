import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { acessoEquipe } from "@/lib/auth/equipe-acesso";
import {
  consultarProcessoDatajud,
  datajudConfigurado,
  type ProcessoDatajud,
} from "@/lib/external/datajud";
import { consultarLexml, type DocumentoLexml } from "@/lib/external/lexml";
import {
  SERVICOS_JURISPRUDENCIA,
  SERVICOS_LEGISLACAO,
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

const TERMO_MAX = 200;

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
}

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
  searchParams: Promise<{
    numero?: string;
    tribunal?: string;
    area?: string;
    termo?: string;
  }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");

  const db = getDb();
  const acesso = await acessoEquipe(db, actor);
  if (!acesso.ok) redirect(acesso.motivo === "sem_papel" ? "/atendimento/meus" : "/assinatura");

  const { numero, tribunal, area: areaRaw, termo: termoRaw } = await searchParams;
  const area = legalAreaSlugSchema.safeParse(areaRaw).data;
  const termo = termoRaw?.trim().slice(0, TERMO_MAX) || (area ? TERMO_POR_AREA[area] : "");

  let processo: ProcessoDatajud | null = null;
  let erroConsulta: string | null = null;
  if (numero && tribunal) {
    try {
      processo = await consultarProcessoDatajud(tribunal, numero);
    } catch (e) {
      erroConsulta = e instanceof Error ? e.message : "Falha ao consultar o DataJud.";
    }
  }

  let documentosLexml: DocumentoLexml[] = [];
  let erroLexml: string | null = null;
  if (termo) {
    try {
      documentosLexml = await consultarLexml(termo);
    } catch (e) {
      erroLexml = e instanceof Error ? e.message : "Falha ao consultar o LexML.";
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Área profissional</p>
        <h1 className="mt-1 text-3xl">Central de Consultas Jurídicas</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Consulte processos, jurisprudência, legislação e publicações oficiais em um só lugar.
          Escolha abaixo o tipo de pesquisa que deseja realizar.
        </p>
        <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Tipos de consulta">
          {[
            ["#processos", "🔎", "Processos", "CNJ e PJe"],
            ["#jurisprudencia", "⚖️", "Jurisprudência", "Decisões e precedentes"],
            ["#legislacao", "📚", "Legislação", "LexML Brasil"],
            ["#diario-oficial", "📰", "Diário Oficial", "Publicações oficiais"],
          ].map(([href, icon, titulo, descricao]) => (
            <a key={href} href={href} className="rounded-xl border border-line p-4 transition hover:border-navy hover:bg-white">
              <span className="text-2xl" aria-hidden="true">{icon}</span>
              <span className="mt-2 block font-semibold">{titulo}</span>
              <span className="mt-1 block text-sm text-muted">{descricao}</span>
            </a>
          ))}
        </nav>
      </div>

      <section id="processos" className="mt-8 scroll-mt-6 rounded-2xl border border-line bg-surface p-6" aria-labelledby="processo-title">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">🔎 Processos</p>
        <h2 id="processo-title" className="mt-1 text-2xl">Consultar processo no CNJ</h2>
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
        <h2 id="jurisprudencia-title" className="sr-only">Pesquisa jurídica</h2>
        <form className="mt-3 flex flex-wrap items-end gap-3">
          {numero && <input type="hidden" name="numero" value={numero} />}
          {tribunal && <input type="hidden" name="tribunal" value={tribunal} />}
          <div>
            <label htmlFor="area" className="block text-sm font-medium">
              Área jurídica (opcional, pré-preenche o termo)
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
          <div>
            <label htmlFor="termo" className="block text-sm font-medium">
              Termo de busca (usado na legislação abaixo)
            </label>
            <input
              id="termo"
              name="termo"
              key={termo}
              defaultValue={termo}
              maxLength={TERMO_MAX}
              placeholder="ex.: rescisão indireta"
              className="mt-1 w-64 rounded border border-line p-2"
            />
          </div>
          <button className="rounded border border-line px-4 py-2">Aplicar</button>
        </form>

        <div className="mt-6 space-y-6">
          <div id="jurisprudencia" className="scroll-mt-6 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">⚖️ Jurisprudência</p>
            <h3 className="mt-1 text-xl font-semibold">Decisões e precedentes</h3>
            <ul className="mt-2 space-y-3">
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
            </ul>
          </div>

          <div id="legislacao" className="scroll-mt-6 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">📚 Legislação</p>
            <h3 className="mt-1 text-xl font-semibold">Pesquisar legislação</h3>
            <p className="mt-1 text-sm text-muted">
              Resultado buscado direto no LexML Brasil (rede pública mantida por Senado, Câmara,
              Judiciário e Ministério Público) — sem precisar abrir outro site.
            </p>

            {erroLexml && (
              <div className="mt-3">
                <Alert tone="error" title="Não foi possível buscar no LexML.">
                  {erroLexml} Tente abrir a busca completa no site, abaixo.
                </Alert>
              </div>
            )}

            {termo && !erroLexml && documentosLexml.length === 0 && (
              <div className="mt-3">
                <Alert title="Nenhum resultado para este termo.">
                  Tente um termo mais genérico, ou abra a busca completa no site, abaixo.
                </Alert>
              </div>
            )}

            {documentosLexml.length > 0 && (
              <ul className="mt-3 space-y-3">
                {documentosLexml.map((doc) => (
                  <li key={doc.urn} className="rounded-md border border-line p-4">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-navy hover:underline"
                    >
                      {doc.titulo}
                    </a>
                    {doc.ementa && <p className="mt-1 text-sm text-muted">{doc.ementa}</p>}
                    <p className="mt-1 text-xs text-muted">
                      {formatarData(doc.data)} · {doc.urn}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {!termo && (
              <p className="mt-3 text-sm text-muted">
                Escolha uma área ou digite um termo acima e clique em &ldquo;Aplicar&rdquo; para
                ver o resultado aqui.
              </p>
            )}

            <ul className="mt-4 space-y-3">
              {SERVICOS_LEGISLACAO.map((s) => (
                <li key={s.id} className="rounded-md border border-line p-4">
                  <p className="font-semibold">Busca completa no site do {s.nome}</p>
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
            </ul>
          </div>

          <div id="diario-oficial" className="scroll-mt-6 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">📰 Diário Oficial</p>
            <h3 className="mt-1 text-xl font-semibold">Publicações oficiais</h3>
            <ul className="mt-2 space-y-3">
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
          </div>
        </div>
      </section>
    </main>
  );
}
