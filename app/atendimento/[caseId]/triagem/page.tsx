import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CaseHeader } from "@/components/case/case-header";
import { TriageStepForm } from "@/components/triage/triage-step-form";
import { FocusOnMount } from "@/components/ui/focus-on-mount";
import { firstIncompleteStep, toFormValue } from "@/domain/triage/engine";
import { triageDraftScope } from "@/domain/draft";
import type { RawFormValues } from "@/domain/triage/schema";
import { loadCaseOr404, redirectIfLocked } from "@/lib/services/load-case";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ etapa?: string }>;
}): Promise<Metadata> {
  const n = Number.parseInt((await searchParams).etapa ?? "", 10);
  // Título distinto por parte: leitores de tela anunciam a troca de etapa.
  return { title: Number.isInteger(n) && n > 0 && n < 50 ? `Triagem — parte ${n}` : "Triagem" };
}
export const dynamic = "force-dynamic";

export default async function TriagemPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ etapa?: string; origem?: string }>;
}) {
  const { caseId } = await params;
  const { etapa, origem } = await searchParams;
  const { service, legalCase } = await loadCaseOr404(caseId);
  redirectIfLocked(legalCase);
  if (!legalCase.applicant) redirect(`/atendimento/${caseId}/identificacao`);

  const ctx = await service.getTriageContext(caseId);
  if (!ctx || ctx.steps.length === 0) notFound();

  const furthest = firstIncompleteStep(ctx.steps, ctx.answers);
  const requested = Number.parseInt(etapa ?? "", 10);
  // Sem etapa informada, retoma de onde parou; não permite pular etapas não respondidas.
  const stepIndex = Number.isNaN(requested)
    ? Math.min(furthest, ctx.steps.length - 1)
    : Math.max(0, Math.min(requested - 1, furthest, ctx.steps.length - 1));
  const step = ctx.steps[stepIndex];

  const draftBaseTime = new Date().toISOString();
  const draft = await service.getDraft(caseId, triageDraftScope(stepIndex));
  const saved: RawFormValues = Object.fromEntries(
    step.questions.map((q) => [q.key, toFormValue(q, ctx.answers[q.key])]),
  );
  // Rascunho não concluído tem prioridade sobre as respostas gravadas desta parte.
  const defaultValues: RawFormValues = draft
    ? { ...saved, ...(draft.values as RawFormValues) }
    : saved;
  const stepKeys = new Set(step.questions.map((q) => q.key));
  // Outras etapas: só respostas válidas contam para visibilidade e regras entre campos.
  const previous = Object.fromEntries(
    Object.entries(ctx.validAnswers).filter(([k]) => !stepKeys.has(k)),
  );
  const initialErrors = Object.fromEntries(
    Object.entries(ctx.invalid).filter(([k]) => stepKeys.has(k)),
  );

  return (
    <>
      <CaseHeader legalCase={ctx.legalCase} area={ctx.area} step="Triagem" />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm text-muted">
          Parte {stepIndex + 1} de {ctx.steps.length}
        </p>
        <h1 id="triagem-titulo" tabIndex={-1} className="mt-1 text-3xl focus:outline-none">
          {step.title}
        </h1>
        <FocusOnMount key={stepIndex} targetId="triagem-titulo" />
        <div
          className="mt-4 h-1 rounded-full bg-line"
          role="progressbar"
          aria-label="Progresso da triagem"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ctx.completion}
          aria-valuetext={`${ctx.completion}% das perguntas obrigatórias respondidas`}
        >
          <div className="h-1 rounded-full bg-navy" style={{ width: `${ctx.completion}%` }} />
        </div>
        <TriageStepForm
          key={`${stepIndex}`}
          caseId={caseId}
          stepIndex={stepIndex}
          totalSteps={ctx.steps.length}
          questions={step.questions}
          defaultValues={defaultValues}
          previousAnswers={previous}
          draftBaseTime={draftBaseTime}
          restoredDraft={Boolean(draft)}
          initialErrors={initialErrors}
          returnTo={origem === "revisao" ? `/atendimento/${caseId}/revisar` : undefined}
        />
      </div>
    </>
  );
}
