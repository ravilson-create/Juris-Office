import type { Metadata } from "next";
import { CaseHeader } from "@/components/case/case-header";
import { IdentificationForm } from "@/components/case/identification-form";
import { loadCaseOr404, redirectIfLocked } from "@/lib/services/load-case";

export const metadata: Metadata = { title: "Identificação" };
export const dynamic = "force-dynamic";

export default async function IdentificacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ origem?: string }>;
}) {
  const { caseId } = await params;
  const { origem } = await searchParams;
  const { service, legalCase, area } = await loadCaseOr404(caseId);
  redirectIfLocked(legalCase);
  const draft = await service.getDraft(caseId, "identificacao");
  const a = legalCase.applicant;

  return (
    <>
      <CaseHeader legalCase={legalCase} area={area} step="Identificação" />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl">Seus dados de contato</h1>
        <p className="mt-2 max-w-prose text-muted">Estes dados compõem o dossiê do seu atendimento.</p>
        <IdentificationForm
          caseId={legalCase.id}
          returnTo={origem === "revisao" ? `/atendimento/${caseId}/revisar` : undefined}
          draftBaseTime={new Date().toISOString()}
          restoredDraft={Boolean(draft)}
          defaultValues={{
            fullName: a?.fullName ?? "",
            email: a?.email ?? "",
            phone: a?.phone ?? "",
            city: a?.city ?? "",
            uf: a?.uf ?? "",
            consentAccepted: legalCase.consentAccepted,
            ...(draft?.values as object | undefined),
          }}
        />
      </div>
    </>
  );
}
