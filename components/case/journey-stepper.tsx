export const JOURNEY_STEPS = [
  "Área",
  "Identificação",
  "Triagem",
  "Relato",
  "Documentos",
  "Revisão",
  "Protocolo",
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

/** Progresso da jornada do cliente. Estado indicado por texto, não só por cor. */
export function JourneyStepper({ current }: { current: JourneyStep }) {
  const currentIndex = JOURNEY_STEPS.indexOf(current);
  return (
    <nav aria-label="Etapas do atendimento" className="overflow-x-auto">
      <p className="mb-2 text-sm text-muted sm:hidden">
        Etapa {currentIndex + 1} de {JOURNEY_STEPS.length}:{" "}
        <strong className="text-ink">{current}</strong>
      </p>
      <ol className="hidden gap-1 sm:flex">
        {JOURNEY_STEPS.map((step, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
          return (
            <li
              key={step}
              aria-current={state === "current" ? "step" : undefined}
              className={`flex flex-1 flex-col gap-1.5 text-xs ${state === "todo" ? "text-muted" : "text-ink"}`}
            >
              <span
                className={`h-1.5 rounded-full ${
                  state === "done" ? "bg-navy" : state === "current" ? "bg-teal" : "bg-line"
                }`}
              />
              <span className={state === "current" ? "font-semibold" : ""}>
                {i + 1}. {step}
                <span className="sr-only">
                  {state === "done"
                    ? " (concluída)"
                    : state === "current"
                      ? " (etapa atual)"
                      : " (pendente)"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="h-1.5 rounded-full bg-line sm:hidden" aria-hidden="true">
        <div
          className="h-1.5 rounded-full bg-navy"
          style={{ width: `${((currentIndex + 1) / JOURNEY_STEPS.length) * 100}%` }}
        />
      </div>
    </nav>
  );
}
