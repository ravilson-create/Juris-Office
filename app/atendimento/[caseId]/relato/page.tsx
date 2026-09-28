import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CaseHeader } from "@/components/case/case-header";
import { NarrativeForm } from "@/components/narrative/narrative-form";
import { firstIncompleteStep } from "@/domain/triage/engine";
import { loadCaseOr404, redirectIfLocked } from "@/lib/services/load-case";

export const metadata: Metadata = { title: "Relato" };
export const dynamic = "force-dynamic";

export default async function RelatoPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ origem?: string }>;
}) {
  const { caseId } = await params;
  const { origem } = await searchParams;
  const { service, legalCase } = await loadCaseOr404(caseId);
  redirectIfLocked(legalCase);
  if (!legalCase.applicant) redirect(`/atendimento/${caseId}/identificacao`);
  const ctx = await service.getTriageContext(caseId);
  if (!ctx) redirect(`/atendimento/${caseId}/triagem`);
  const pending = firstIncompleteStep(ctx.steps, ctx.answers);
  const draft = await service.getDraft(caseId, "relato");
  if (pending < ctx.steps.length) redirect(`/atendimento/${caseId}/triagem?etapa=${pending + 1}`);

  return (
    <>
      <CaseHeader legalCase={ctx.legalCase} area={ctx.area} step="Relato" />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl">Conte o que aconteceu</h1>
        <p className="mt-2 max-w-prose text-muted">
          As perguntas já organizaram os pontos principais. Aqui você explica a situação do seu
          jeito, com os detalhes que achar importantes.
        </p>
        <NarrativeForm
          caseId={caseId}
          defaultValue={draft ? String(draft.values.narrative ?? "") : (legalCase.narrative ?? "")}
          draftBaseTime={new Date().toISOString()}
          restoredDraft={Boolean(draft)}
          backHref={`/atendimento/${caseId}/triagem?etapa=${ctx.steps.length}`}
          returnTo={origem === "revisao" ? `/atendimento/${caseId}/revisar` : undefined}
        />
      </div>
    </>
  );
}
