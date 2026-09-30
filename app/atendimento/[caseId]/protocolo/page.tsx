import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandSymbol } from "@/components/brand/brand-logo";
import { CaseHeader } from "@/components/case/case-header";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { FocusOnMount } from "@/components/ui/focus-on-mount";
import { formatInstantDateTime } from "@/domain/time";
import { loadCaseOr404 } from "@/lib/services/load-case";

export const metadata: Metadata = { title: "Protocolo" };
export const dynamic = "force-dynamic";

const WHAT_HAPPENED = [
  "O dossiê foi gerado a partir das suas respostas, sem uso de inteligência artificial.",
  "O atendimento fica disponível à equipe para encaminhamento a um advogado.",
  "Os documentos aparecem só como registro: nenhum arquivo foi recebido.",
  "Você pode acompanhar o andamento na página de consulta usando seu protocolo.",
];

export default async function ProtocoloPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const { service } = await loadCaseOr404(caseId);
  const submission = await service.getSubmission(caseId);
  if (!submission) redirect(`/atendimento/${caseId}/revisar`);
  const { legalCase, area, dossier } = submission;
  const sentAt = formatInstantDateTime(legalCase.submittedAt!);

  return (
    <>
      <FocusOnMount targetId="protocolo-titulo" />
      <CaseHeader legalCase={legalCase} area={area} step="Protocolo" />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <section
          aria-labelledby="protocolo-titulo"
          className="flex flex-col items-start gap-5 rounded-md border-2 border-teal bg-surface p-6 sm:flex-row sm:p-8"
        >
          <BrandSymbol height={72} priority className="h-16 w-auto shrink-0 sm:h-[72px]" />
          <div>
            <h1 id="protocolo-titulo" tabIndex={-1} className="text-3xl focus:outline-none">
              Atendimento de teste finalizado
            </h1>
            <p className="mt-2 text-muted">
              Dossiê gerado para demonstração. O número abaixo identifica este atendimento de teste;
              use-o em “Consultar solicitação” para acompanhar o andamento em qualquer dispositivo.
            </p>
            <p className="mt-5 text-sm text-muted">Número do protocolo</p>
            <p
              className="mt-1 break-all text-lg font-bold tracking-wide text-navy tabular-nums sm:text-xl"
              data-testid="protocolo-final"
            >
              {legalCase.protocol}
            </p>
            <p className="mt-3 text-sm text-muted">
              Finalizado em {sentAt} (horário de Brasília) · Área: {area.name}
            </p>
          </div>
        </section>

        <p className="mt-6">
          Guarde seu protocolo: ele é seu código de acesso ao andamento.{" "}
          <a className="underline" href="/consulta">
            Consultar solicitação
          </a>
        </p>
        <section aria-labelledby="proximos-passos" className="mt-10">
          <h2 id="proximos-passos" className="text-xl">
            O que aconteceu
          </h2>
          <ol className="mt-4 flex flex-col gap-3">
            {WHAT_HAPPENED.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-navy text-sm font-semibold text-navy"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-prose text-sm text-muted">
            O envio real de arquivos ainda não está disponível. Nesta etapa, use somente dados
            fictícios.
          </p>
        </section>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row">
          {/*
            Link HTML comum (carregamento completo), não o roteador do Next: logo após o envio,
            uma navegação cliente iniciada enquanto a ação de servidor conclui o redirecionamento
            pode ser descartada. O dossiê é uma página de documento, então o custo é desprezível.
          */}
          <a href={`/atendimento/${caseId}/dossie`} className={buttonClass("primary")}>
            Ver o dossiê gerado
          </a>
          <ButtonLink href="/atendimento/meus" variant="secondary">
            Meus atendimentos
          </ButtonLink>
        </div>
        <p className="mt-3 text-sm text-muted">
          Dossiê versão {dossier.version}, gerado automaticamente a partir das suas respostas.
        </p>
      </div>
    </>
  );
}
