import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { finishDocumentsAction } from "@/app/atendimento/actions";
import { CaseHeader } from "@/components/case/case-header";
import { DocumentChecklist } from "@/components/documents/document-checklist";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { MAX_DOCUMENTS_PER_CASE } from "@/domain/document/rules";
import { OTHER_DOCUMENTS_CATEGORY, OTHER_DOCUMENTS_LABEL } from "@/domain/document/schema";
import { loadCaseOr404, redirectIfLocked } from "@/lib/services/load-case";

export const metadata: Metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

export default async function DocumentosPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const { service, legalCase } = await loadCaseOr404(caseId);
  redirectIfLocked(legalCase);
  if (!legalCase.narrative) redirect(`/atendimento/${caseId}/relato`);
  const ctx = await service.getDocumentsContext(caseId);
  if (!ctx) redirect(`/atendimento/${caseId}/relato`);

  const entries = [
    ...ctx.checklist.map(({ category, label, description, recommended }) => ({
      category,
      label,
      description,
      recommended,
    })),
    {
      category: OTHER_DOCUMENTS_CATEGORY,
      label: OTHER_DOCUMENTS_LABEL,
      description: "Qualquer outro documento que ajude a entender o caso.",
      recommended: false,
    },
  ];

  return (
    <>
      <CaseHeader legalCase={ctx.legalCase} area={ctx.area} step="Documentos" />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl">Documentos do caso</h1>
        <p className="mt-2 max-w-prose text-muted">
          Indique os documentos que você teria para este caso. Nenhum é obrigatório; os marcados
          como recomendados costumam ser os mais úteis num atendimento real.
        </p>
        <div className="mt-6">
          <Alert title="Envio simulado: nenhum arquivo é recebido">
            O arquivo escolhido não sai do seu aparelho. Registramos apenas nome, tipo e tamanho,
            para simular a lista de documentos do dossiê. Limite de {MAX_DOCUMENTS_PER_CASE}{" "}
            registros por atendimento.
          </Alert>
        </div>

        <div className="mt-8">
          <DocumentChecklist caseId={caseId} entries={entries} documents={ctx.documents} />
        </div>

        <form
          action={finishDocumentsAction}
          className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between"
        >
          <input type="hidden" name="caseId" value={caseId} />
          <ButtonLink href={`/atendimento/${caseId}/relato`} variant="secondary">
            Voltar
          </ButtonLink>
          <SubmitButton pendingLabel="Abrindo revisão…">Continuar para a revisão</SubmitButton>
        </form>
      </div>
    </>
  );
}
