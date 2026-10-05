import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { PeticaoSecaoEditor } from "@/components/petitions/peticao-secao-editor";
import { GerarPecaForm } from "@/components/pecas/gerar-peca-form";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { acessoEquipe } from "@/lib/auth/equipe-acesso";
import { getCaseService } from "@/lib/services";
import { buscarAuxiliosIARestantes, LIMITE_AUXILIOS_IA_MES } from "@/lib/services/ai-quota";
import { CAMPOS_PECA, TITULO_PECA, tiposDisponiveisParaArea, type TipoPeca } from "@/domain/pecas/schema";
import type { PetitionSection } from "@/domain/petition/schema";
import {
  excluirPeticaoAction,
  finalizarPeticaoAction,
  salvarPeticaoAction,
} from "../peticao/actions";

export const dynamic = "force-dynamic";

export default async function PecasPage({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { caseId } = await params;
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

  const tiposPeca = tiposDisponiveisParaArea(ctx.area.slug).map((tipo) => ({
    tipo,
    titulo: TITULO_PECA[tipo],
    campos: CAMPOS_PECA[tipo],
  }));

  const pecas = await db.query<{
    id: string;
    tipo: TipoPeca;
    titulo_modelo: string;
    secoes: PetitionSection[];
    secoes_revisadas_ia: string[];
    criado_em: Date;
    finalizado_em: Date | null;
  }>(
    `SELECT id, tipo, titulo_modelo, secoes, secoes_revisadas_ia, criado_em, finalizado_em
     FROM case_petitions WHERE case_id = $1 AND tipo <> 'peticao_inicial' ORDER BY criado_em DESC`,
    [caseId],
  );
  const auxiliosRestantes = await buscarAuxiliosIARestantes(db);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p>
        <Link href={`/equipe/${caseId}`}>Voltar ao caso</Link>
      </p>
      <h1 className="mt-4 text-3xl">Peças do processo</h1>
      <p className="mt-2 text-sm text-muted">
        Réplica, recursos e demais peças que surgem depois de uma decisão do juízo ou ato da
        parte contrária — diferente da{" "}
        <Link href={`/equipe/${caseId}/peticao`} className="underline">
          petição inicial
        </Link>
        , que vem só da triagem, aqui o fato que origina a peça (o que a decisão disse, o que a
        contestação alegou) precisa ser informado por você: nada é inventado.
      </p>
      <p className="mt-1 text-xs text-muted">
        Restam {auxiliosRestantes} de {LIMITE_AUXILIOS_IA_MES} auxílios de IA este mês (cota
        única, compartilhada com a correção de redação da petição inicial).
      </p>

      <GerarPecaForm caseId={caseId} tipos={tiposPeca} />

      {pecas.length === 0 ? (
        <p className="mt-8 text-muted">Nenhuma peça gerada ainda.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {pecas.map((peca) => (
            <section key={peca.id} className="rounded-md border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl">{peca.titulo_modelo}</h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      peca.finalizado_em
                        ? "bg-gold-soft text-gold-strong"
                        : "bg-navy-soft text-navy-strong"
                    }`}
                  >
                    {peca.finalizado_em ? "Assinada" : "Rascunho"}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(peca.criado_em).toLocaleString("pt-BR", {
                      timeZone: "America/Fortaleza",
                    })}
                  </span>
                </div>
              </div>

              {peca.finalizado_em ? (
                <div className="mt-4 space-y-6">
                  {peca.secoes.map((secao) => (
                    <div key={secao.chave}>
                      <p className="font-sans font-semibold text-ink">{secao.titulo}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{secao.corpo}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <form action={salvarPeticaoAction} className="mt-4 space-y-6">
                  <input type="hidden" name="petitionId" value={peca.id} />
                  <input type="hidden" name="caseId" value={caseId} />
                  {peca.secoes.map((secao) => (
                    <PeticaoSecaoEditor
                      key={secao.chave}
                      petitionId={peca.id}
                      chave={secao.chave}
                      titulo={secao.titulo}
                      corpoInicial={secao.corpo}
                      revisadoIAInicial={peca.secoes_revisadas_ia.includes(secao.chave)}
                    />
                  ))}
                  <button className="rounded bg-navy px-4 py-2 text-white">Salvar alterações</button>
                </form>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={`/api/peticoes/${peca.id}/docx`}
                  className="inline-block rounded border border-line px-4 py-2"
                >
                  Baixar .docx
                </a>
                <a
                  href={`/api/peticoes/${peca.id}/pdf`}
                  className="inline-block rounded border border-line px-4 py-2"
                >
                  Baixar PDF
                </a>
                {!peca.finalizado_em && acesso.oabConfirmada && (
                  <form action={finalizarPeticaoAction}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="petitionId" value={peca.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Assinar esta peça? Ela deixa de poder ser editada."
                      className="rounded bg-gold-strong px-4 py-2 text-white hover:brightness-90"
                    >
                      Finalizar e assinar
                    </ConfirmSubmitButton>
                  </form>
                )}
                {!peca.finalizado_em && (
                  <form action={excluirPeticaoAction}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="petitionId" value={peca.id} />
                    <ConfirmSubmitButton
                      confirmMessage="Excluir esta peça? Essa ação não pode ser desfeita."
                      className="rounded border border-danger px-4 py-2 text-danger hover:bg-danger-soft"
                    >
                      Excluir
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
