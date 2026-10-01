import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { modelosDisponiveis } from "@/lib/petitions/gerar";
import type { PetitionSection } from "@/domain/petition/schema";
import { gerarPeticaoAction, salvarPeticaoAction } from "./actions";

export const dynamic = "force-dynamic";

const NOMES_MODELO: Record<string, string> = {
  "familia.acao_alimentos": "Ação de Alimentos",
  "familia.regulamentacao_guarda": "Ação de Regulamentação de Guarda e Convivência",
  "familia.divorcio_litigioso": "Ação de Divórcio Litigioso",
  "familia.uniao_estavel": "Ação de Reconhecimento e Dissolução de União Estável",
  "familia.partilha_bens": "Ação de Partilha de Bens",
  "civel.rescisao_contratual": "Ação de Rescisão Contratual c/c Indenização",
  "civel.acao_cobranca": "Ação de Cobrança",
  "civel.indenizacao_danos": "Ação de Indenização por Danos Morais e Materiais",
  "civel.despejo_cobranca_alugueis": "Ação de Despejo c/c Cobrança de Aluguéis",
  "civel.obrigacao_fazer_nao_fazer": "Ação de Obrigação de Fazer/Não Fazer",
};

export default async function PeticaoPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const existentes = await db.query<{
    id: string;
    modelo_id: string;
    titulo_modelo: string;
    secoes: PetitionSection[];
    pendencias: string[];
    atualizado_em: Date;
  }>(
    "SELECT id, modelo_id, titulo_modelo, secoes, pendencias, atualizado_em FROM case_petitions WHERE case_id = $1 ORDER BY criado_em DESC",
    [caseId],
  );
  const peticaoAtual = existentes[0];
  const modelos = modelosDisponiveis(ctx.area.slug, ctx.validAnswers);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="print:hidden">
        <Link href={`/equipe/${caseId}`}>Voltar ao caso</Link>
      </p>
      <h1 className="mt-4 text-3xl">Petição inicial</h1>
      <p className="mt-2 text-sm text-muted">
        Gerada automaticamente a partir dos dados do atendimento — nenhum dado é inventado. Revise
        e complete os campos pendentes antes de protocolar.
      </p>

      {modelos.length === 0 && !peticaoAtual && (
        <p className="mt-8 rounded-md border border-line bg-surface p-4">
          Ainda não há modelo de petição disponível para a área deste caso ({ctx.area.name}).
        </p>
      )}

      {modelos.length > 0 && (
        <form action={gerarPeticaoAction} className="mt-8 flex flex-wrap items-center gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="modeloId" value={modelos[0]} />
          <button className="rounded bg-navy px-4 py-2 text-white">
            {peticaoAtual ? "Gerar nova versão" : `Gerar: ${NOMES_MODELO[modelos[0]] ?? modelos[0]}`}
          </button>
        </form>
      )}

      {peticaoAtual && (
        <section className="mt-8">
          <h2 className="text-2xl">{peticaoAtual.titulo_modelo}</h2>
          <p className="mt-1 text-xs text-muted">
            Atualizado em{" "}
            {new Date(peticaoAtual.atualizado_em).toLocaleString("pt-BR", {
              timeZone: "America/Fortaleza",
            })}
          </p>

          {peticaoAtual.pendencias.length > 0 && (
            <div className="mt-4 rounded-md border border-line bg-surface p-4">
              <p className="font-semibold">Campos pendentes de preenchimento:</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {peticaoAtual.pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <form action={salvarPeticaoAction} className="mt-6 space-y-6">
            <input type="hidden" name="petitionId" value={peticaoAtual.id} />
            <input type="hidden" name="caseId" value={caseId} />
            {peticaoAtual.secoes.map((secao) => (
              <div key={secao.chave}>
                <input type="hidden" name="chave" value={secao.chave} />
                <label htmlFor={`corpo-${secao.chave}`} className="block font-semibold">
                  {secao.titulo}
                </label>
                <textarea
                  id={`corpo-${secao.chave}`}
                  name={`corpo:${secao.chave}`}
                  defaultValue={secao.corpo}
                  rows={Math.min(14, Math.max(3, secao.corpo.split("\n").length + 1))}
                  className="mt-2 w-full rounded border border-line p-3 font-serif text-sm"
                />
              </div>
            ))}
            <button className="rounded bg-navy px-4 py-2 text-white">Salvar alterações</button>
          </form>

          <a
            href={`/api/peticoes/${peticaoAtual.id}/docx`}
            className="mt-4 inline-block rounded border border-line px-4 py-2"
          >
            Baixar .docx
          </a>
        </section>
      )}
    </main>
  );
}
