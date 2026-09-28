import type { LegalCase } from "@/domain/case/schema";
import type { LegalArea } from "@/domain/legal-area/schema";
import { JourneyStepper, type JourneyStep } from "./journey-stepper";

export function CaseHeader({
  legalCase,
  area,
  step,
}: {
  legalCase: LegalCase;
  area: LegalArea;
  step: JourneyStep;
}) {
  return (
    <div className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-5">
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted">Área:</dt>
            <dd className="font-medium">{area.name}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">
              {legalCase.submittedAt ? "Protocolo:" : "Protocolo provisório:"}
            </dt>
            <dd className="font-medium tabular-nums">{legalCase.protocol}</dd>
          </div>
        </dl>
        <JourneyStepper current={step} />
      </div>
    </div>
  );
}
