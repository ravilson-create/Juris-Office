import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { PeticaoSecaoEditor } from "@/components/petitions/peticao-secao-editor";
import { GerarPecaForm } from "@/components/pecas/gerar-peca-form";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { buscarAuxiliosIARestantes, LIMITE_AUXILIOS_IA_MES } from "@/lib/services/ai-quota";
import { CAMPOS_PECA, TITULO_PECA, tipoPecaSchema, type TipoPeca } from "@/domain/pecas/schema";
import type { PetitionSection } from "@/domain/petition/schema";
import { excluirPeticaoAction, salvarPeticaoAction } from "../peticao/actions";

export const dynamic = "force-dynamic";

const TIPOS_PECA = tipoPecaSchema.options.map((tipo) => ({
  tipo,
  titulo: TITULO_PECA[tipo],
  campos: CAMPOS_PECA[tipo],
}));

export default async function PecasPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  const pecas = await db.query<{
    id: string;
    tipo: TipoPeca;
    titulo_modelo: string;
    secoes: PetitionSection[];
    secoes_revisadas_ia: string[];
    criado_em: Date;
  }>(
    `SELECT id, tipo, titulo_modelo, secoes, secoes_revisadas_ia, criado_em
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

      <GerarPecaForm caseId={caseId} tipos={TIPOS_PECA} />

      {pecas.length === 0 ? (
        <p className="mt-8 text-muted">Nenhuma peça gerada ainda.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {pecas.map((peca) => (
            <section key={peca.id} className="rounded-md border border-line bg-surface p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl">{peca.titulo_modelo}</h2>
                <span className="text-xs text-muted">
                  {new Date(peca.criado_em).toLocaleString("pt-BR", {
                    timeZone: "America/Fortaleza",
                  })}
                </span>
              </div>

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
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
