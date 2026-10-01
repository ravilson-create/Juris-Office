import type { Metadata } from "next";
import { JourneyStepper } from "@/components/case/journey-stepper";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCaseService } from "@/lib/services";
import { createCaseAction } from "./actions";

export const metadata: Metadata = { title: "Escolha a área" };
export const dynamic = "force-dynamic";

const COMO_PROCEDER = [
  { title: "Escolha o assunto", text: "Consumidor, trabalho, família, INSS ou questões cíveis." },
  { title: "Responda perguntas simples", text: "Uma etapa por vez. Você pode voltar e corrigir." },
  { title: "Conte o que aconteceu", text: "Com suas palavras, e indique os documentos que tiver." },
  {
    title: "Gere o dossiê",
    text: "Um resumo organizado do caso, com protocolo, para você conferir.",
  },
];

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const areas = (await getCaseService().listLegalAreas()).filter((a) => a.active);

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-5">
          <JourneyStepper current="Área" />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl">Sobre qual assunto é o seu problema?</h1>
        <p className="mt-2 max-w-prose text-muted">
          Escolha a opção mais próxima. Se tiver dúvida, escolha a mais parecida: você pode iniciar
          outro atendimento de teste depois.
        </p>

        <div className="mt-8 rounded-md border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Como proceder</h2>
          <ol aria-label="Como é o atendimento" className="mt-4 grid gap-6 sm:grid-cols-2">
            {COMO_PROCEDER.map((passo, i) => (
              <li key={passo.title} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-serif text-sm font-semibold ${
                    i === COMO_PROCEDER.length - 1
                      ? "bg-teal-strong text-white"
                      : "border-2 border-navy bg-surface text-navy"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-sans text-sm font-semibold text-ink">{passo.title}</p>
                  <p className="text-sm text-muted">{passo.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {erro === "area" && (
          <div className="mt-6">
            <Alert tone="error" title="Esta área não está disponível no momento.">
              Escolha outra opção abaixo.
            </Alert>
          </div>
        )}

        {erro === "limite" && (
          <div className="mt-6">
            <Alert tone="error" title="Muitos atendimentos em pouco tempo.">
              Aguarde alguns minutos e tente de novo.
            </Alert>
          </div>
        )}

        {areas.length === 0 ? (
          <div className="mt-8">
            <Alert title="Nenhuma área disponível agora">
              O atendimento on-line está temporariamente indisponível. Tente novamente mais tarde.
            </Alert>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {areas.map((area) => (
              <li key={area.id}>
                <form
                  action={createCaseAction}
                  className="flex h-full flex-col gap-3 rounded-md border border-line bg-surface p-5 transition-colors focus-within:border-navy hover:border-navy"
                >
                  <input type="hidden" name="area" value={area.slug} />
                  <h2 className="text-xl">{area.name}</h2>
                  <p className="text-muted">{area.description}</p>
                  <p className="text-sm text-muted">
                    Exemplos: {area.examples.join(", ").toLowerCase()}.
                  </p>
                  <SubmitButton
                    variant="secondary"
                    className="mt-auto self-start"
                    pendingLabel="Abrindo…"
                  >
                    Escolher {area.name}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
