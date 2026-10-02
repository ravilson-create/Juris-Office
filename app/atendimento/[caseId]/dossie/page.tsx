import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DossierView } from "@/components/dossier/dossier-view";
import { PrintButton } from "@/components/dossier/print-button";
import { ButtonLink } from "@/components/ui/button";
import { loadCaseOr404 } from "@/lib/services/load-case";

export const metadata: Metadata = { title: "Dossiê" };
export const dynamic = "force-dynamic";

export default async function DossiePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const { service } = await loadCaseOr404(caseId);
  const submission = await service.getSubmission(caseId);
  if (!submission) redirect(`/atendimento/${caseId}/revisar`);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <ButtonLink href={`/atendimento/${caseId}/protocolo`} variant="ghost" className="px-0">
          Voltar ao protocolo
        </ButtonLink>
        <div className="flex items-center gap-3">
          <ButtonLink href={`/atendimento/${caseId}/contrato`} variant="secondary">
            Contrato
          </ButtonLink>
          <PrintButton />
        </div>
      </div>
      <h1 className="sr-only">Dossiê do protocolo {submission.dossier.protocol}</h1>
      <DossierView dossier={submission.dossier} />
    </div>
  );
}
