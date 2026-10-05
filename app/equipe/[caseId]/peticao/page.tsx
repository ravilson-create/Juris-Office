import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { PeticaoSecaoEditor } from "@/components/petitions/peticao-secao-editor";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { acessoEquipe } from "@/lib/auth/equipe-acesso";
import { getCaseService } from "@/lib/services";
import { modelosDisponiveis } from "@/lib/petitions/gerar";
import { buscarAuxiliosIARestantes, LIMITE_AUXILIOS_IA_MES } from "@/lib/services/ai-quota";
import type { PetitionSection } from "@/domain/petition/schema";
import {
  excluirPeticaoAction,
  finalizarPeticaoAction,
  gerarPeticaoAction,
  salvarPeticaoAction,
} from "./actions";

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
  "consumidor.declaratoria_inexistencia_negativacao":
    "Ação Declaratória de Inexistência de Débito c/c Danos Morais (negativação)",
  "consumidor.declaratoria_inexistencia_cobranca":
    "Ação Declaratória de Inexistência de Débito c/c Repetição de Indébito",
  "consumidor.obrigacao_fazer_produto_servico": "Ação de Obrigação de Fazer c/c Indenização",
  "trabalhista.reclamacao_trabalhista": "Reclamação Trabalhista",
  "previdenciario.concessao_aposentadoria": "Ação de Concessão de Aposentadoria",
  "previdenciario.concessao_incapacidade": "Ação de Concessão de Benefício por Incapacidade",
  "previdenciario.restabelecimento_incapacidade": "Ação de Restabelecimento de Benefício por Incapacidade",
  "previdenciario.concessao_pensao_morte": "Ação de Concessão de Pensão por Morte",
  "previdenciario.concessao_bpc": "Ação de Concessão de BPC/LOAS",
  "previdenciario.concessao_maternidade": "Ação de Concessão de Salário-Maternidade",
  "previdenciario.revisao_beneficio": "Ação Revisional de Benefício Previdenciário",
};

export default async function PeticaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ peticaoId?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { caseId } = await params;
  const { peticaoId } = await searchParams;
  if (!z.uuid().safeParse(caseId).success) notFound();

  const db = getDb();
  const acesso = await acessoEquipe(db, actor);
  if (!acesso.ok) {
    if (acesso.motivo === "sem_papel") notFound();
    redirect("/assinatura");
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
    secoes_revisadas_ia: string[];
    criado_em: Date;
    atualizado_em: Date;
    finalizado_em: Date | null;
    finalizado_por: string | null;
  }>(
    `SELECT id, modelo_id, titulo_modelo, secoes, pendencias, secoes_revisadas_ia, criado_em,
       atualizado_em, finalizado_em, finalizado_por
     FROM case_petitions WHERE case_id = $1 ORDER BY criado_em DESC`,
    [caseId],
  );
  const peticaoAtual =
    (peticaoId && existentes.find((p) => p.id === peticaoId)) || existentes[0];
  const outrasVersoes = existentes.filter((p) => p.id !== peticaoAtual?.id);
  const modelos = modelosDisponiveis(ctx.area.slug, ctx.validAnswers);
  const auxiliosRestantes = await buscarAuxiliosIARestantes(db);

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
      <p className="mt-1 text-xs text-muted">
        Restam {auxiliosRestantes} de {LIMITE_AUXILIOS_IA_MES} auxílios de IA este mês (vale para
        a correção de redação aqui e em qualquer peça em{" "}
        <Link href={`/equipe/${caseId}/pecas`} className="underline">
          Peças
        </Link>
        ).
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl">{peticaoAtual.titulo_modelo}</h2>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                peticaoAtual.finalizado_em
                  ? "bg-gold-soft text-gold-strong"
                  : "bg-navy-soft text-navy-strong"
              }`}
            >
              {peticaoAtual.finalizado_em ? "Assinada" : "Rascunho"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Atualizado em{" "}
            {new Date(peticaoAtual.atualizado_em).toLocaleString("pt-BR", {
              timeZone: "America/Fortaleza",
            })}
          </p>
          {peticaoAtual.finalizado_em && (
            <p className="mt-1 text-xs text-muted">
              Assinada em{" "}
              {new Date(peticaoAtual.finalizado_em).toLocaleString("pt-BR", {
                timeZone: "America/Fortaleza",
              })}{" "}
              — não é a assinatura para protocolar em juízo, só a confirmação interna de quem
              aprovou esta versão no escritório.
            </p>
          )}

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

          {peticaoAtual.finalizado_em ? (
            <div className="mt-6 space-y-6">
              {peticaoAtual.secoes.map((secao) => (
                <div key={secao.chave}>
                  <p className="font-sans font-semibold text-ink">{secao.titulo}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{secao.corpo}</p>
                </div>
              ))}
              <p className="text-sm text-muted">
                Versão assinada — para corrigir, gere uma nova versão acima.
              </p>
            </div>
          ) : (
            <form action={salvarPeticaoAction} className="mt-6 space-y-6">
              <input type="hidden" name="petitionId" value={peticaoAtual.id} />
              <input type="hidden" name="caseId" value={caseId} />
              {peticaoAtual.secoes.map((secao) => (
                <PeticaoSecaoEditor
                  key={secao.chave}
                  petitionId={peticaoAtual.id}
                  chave={secao.chave}
                  titulo={secao.titulo}
                  corpoInicial={secao.corpo}
                  revisadoIAInicial={peticaoAtual.secoes_revisadas_ia.includes(secao.chave)}
                />
              ))}
              <button className="rounded bg-navy px-4 py-2 text-white">Salvar alterações</button>
            </form>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`/api/peticoes/${peticaoAtual.id}/docx`}
              className="inline-block rounded border border-line px-4 py-2"
            >
              Baixar .docx
            </a>
            <a
              href={`/api/peticoes/${peticaoAtual.id}/pdf`}
              className="inline-block rounded border border-line px-4 py-2"
            >
              Baixar PDF
            </a>
            {!peticaoAtual.finalizado_em && acesso.oabConfirmada && (
              <form action={finalizarPeticaoAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="petitionId" value={peticaoAtual.id} />
                <ConfirmSubmitButton
                  confirmMessage="Assinar esta versão? Ela deixa de poder ser editada — uma correção depois disso exige gerar uma nova versão."
                  className="rounded bg-gold-strong px-4 py-2 text-white hover:brightness-90"
                >
                  Finalizar e assinar
                </ConfirmSubmitButton>
              </form>
            )}
            {!peticaoAtual.finalizado_em && (
              <form action={excluirPeticaoAction}>
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="petitionId" value={peticaoAtual.id} />
                <ConfirmSubmitButton
                  confirmMessage="Excluir esta versão da petição? Essa ação não pode ser desfeita."
                  className="rounded border border-danger px-4 py-2 text-danger hover:bg-danger-soft"
                >
                  Excluir esta versão
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        </section>
      )}

      {outrasVersoes.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-xl">Outras versões desta petição</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {outrasVersoes.map((versao) => (
              <li
                key={versao.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-4"
              >
                <div>
                  <p className="font-medium">{versao.titulo_modelo}</p>
                  <p className="text-xs text-muted">
                    Criada em{" "}
                    {new Date(versao.criado_em).toLocaleString("pt-BR", {
                      timeZone: "America/Fortaleza",
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/equipe/${caseId}/peticao?peticaoId=${versao.id}`}
                    className="rounded border border-line px-3 py-1.5 text-sm font-medium hover:border-navy"
                  >
                    Abrir esta versão
                  </Link>
                  <form action={excluirPeticaoAction}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="petitionId" value={versao.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Excluir esta versão da petição? Essa ação não pode ser desfeita."
                      className="rounded border border-danger px-3 py-1.5 text-sm text-danger hover:bg-danger-soft"
                    >
                      Excluir
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
