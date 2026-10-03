import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CaseHeader } from "@/components/case/case-header";
import { DossierLetterhead } from "@/components/dossier/dossier-letterhead";
import { submitCaseAction } from "@/app/atendimento/actions";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { CASE_STATUS_LABEL } from "@/domain/case/status";
import { formatFileSize } from "@/domain/document/rules";
import { OTHER_DOCUMENTS_CATEGORY, OTHER_DOCUMENTS_LABEL } from "@/domain/document/schema";
import { firstIncompleteStep, formatAnswer, isVisible } from "@/domain/triage/engine";
import { getDb, hasDatabase } from "@/lib/db/connection";
import { buscarAdvogadoEscolhido } from "@/lib/services/advogados-disponiveis";
import { loadCaseOr404, redirectIfLocked } from "@/lib/services/load-case";

export const metadata: Metadata = { title: "Revisão" };
export const dynamic = "force-dynamic";

const FROM_REVIEW = "origem=revisao";

export default async function RevisarPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const { service, legalCase } = await loadCaseOr404(caseId);
  redirectIfLocked(legalCase);
  const base = `/atendimento/${caseId}`;
  if (!legalCase.applicant) redirect(`${base}/identificacao`);
  const ctx = await service.getReviewContext(caseId);
  if (!ctx) redirect(`${base}/triagem`);
  const pending = firstIncompleteStep(ctx.steps, ctx.answers);
  if (pending < ctx.steps.length) redirect(`${base}/triagem?etapa=${pending + 1}`);
  if (!legalCase.narrative) redirect(`${base}/relato`);
  if (legalCase.status === "awaiting_documents") redirect(`${base}/documentos`);
  const advogadoEscolhido = hasDatabase() ? await buscarAdvogadoEscolhido(getDb(), caseId) : null;

  const applicant = legalCase.applicant;
  const labelOf = (category: string) =>
    category === OTHER_DOCUMENTS_CATEGORY
      ? OTHER_DOCUMENTS_LABEL
      : (ctx.checklist.find((i) => i.category === category)?.label ?? category);

  return (
    <>
      <CaseHeader legalCase={ctx.legalCase} area={ctx.area} step="Revisão" />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-3xl">Revise antes de finalizar</h1>
        <p className="mt-2 max-w-prose text-muted">
          Este é o conteúdo do dossiê de demonstração. Confira cada parte e use “Corrigir” se algo
          estiver errado.
        </p>

        <article
          aria-label="Prévia do dossiê"
          className="mt-8 rounded-md border border-line bg-surface p-5 sm:p-8"
        >
          <DossierLetterhead
            title="Prévia do dossiê jurídico preliminar"
            protocol={legalCase.protocol}
            areaName={ctx.area.name}
            date={new Date().toISOString()}
            statusLabel={CASE_STATUS_LABEL[legalCase.status]}
          />

          <div className="mt-6 flex flex-col gap-8">
            <ReviewSection title="Seus dados" editHref={`${base}/identificacao?${FROM_REVIEW}`}>
              <dl className="divide-y divide-line">
                <Row term="Nome" value={applicant.fullName} />
                <Row term="CPF" value={formatCpf(applicant.cpf)} />
                <Row term="E-mail" value={applicant.email} />
                <Row term="Telefone" value={formatPhone(applicant.phone)} />
                <Row term="Cidade" value={`${applicant.city} / ${applicant.uf}`} />
              </dl>
            </ReviewSection>

            {ctx.steps.map((step) => (
              <ReviewSection
                key={step.title}
                title={step.title}
                editHref={`${base}/triagem?etapa=${step.index + 1}&${FROM_REVIEW}`}
              >
                <dl className="divide-y divide-line">
                  {step.questions
                    .filter((q) => isVisible(q, ctx.validAnswers))
                    .map((q) => (
                      <Row
                        key={q.key}
                        term={q.label}
                        value={formatAnswer(q, ctx.validAnswers[q.key])}
                        muted={ctx.validAnswers[q.key] === undefined}
                      />
                    ))}
                </dl>
              </ReviewSection>
            ))}

            <ReviewSection title="Relato" editHref={`${base}/relato?${FROM_REVIEW}`}>
              <p className="whitespace-pre-line py-3 leading-relaxed">{legalCase.narrative}</p>
            </ReviewSection>

            <ReviewSection title="Documentos" editHref={`${base}/documentos`}>
              {ctx.documents.length === 0 ? (
                <p className="py-3 text-muted">Nenhum documento registrado.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {ctx.documents.map((d) => (
                    <li key={d.id} className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr] sm:gap-6">
                      <span className="text-sm text-muted">{labelOf(d.category)}</span>
                      <span>
                        {d.originalName}
                        {d.size !== undefined && (
                          <span className="text-sm text-muted"> ({formatFileSize(d.size)})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {ctx.missingRecommended.length > 0 && (
                <p className="mt-2 text-sm text-muted">
                  Recomendados não registrados:{" "}
                  {ctx.missingRecommended.map((i) => i.label).join(", ")}. Eles aparecerão no dossiê
                  como informação pendente.
                </p>
              )}
            </ReviewSection>
          </div>
        </article>

        {hasDatabase() && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-5 sm:p-6">
            <div>
              <h2 className="text-xl">Advogado</h2>
              <p className="mt-1 max-w-prose text-muted">
                {advogadoEscolhido
                  ? `Escolhido: ${advogadoEscolhido.escritorio}.`
                  : "Opcional: você pode escolher quem vai cuidar do seu caso, por especialidade e localização."}
              </p>
            </div>
            <ButtonLink href={`${base}/advogado`} variant="secondary">
              {advogadoEscolhido ? "Trocar" : "Escolher advogado"}
            </ButtonLink>
          </div>
        )}

        <form
          action={submitCaseAction}
          className="mt-8 flex flex-col gap-4 rounded-md border border-line bg-surface p-5 sm:p-6"
        >
          <input type="hidden" name="caseId" value={caseId} />
          <h2 className="text-xl">Tudo certo?</h2>
          <p className="max-w-prose text-muted">
            Ao finalizar, o sistema gera o dossiê e o protocolo deste atendimento, e as informações
            não podem mais ser alteradas.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <ButtonLink href={`${base}/documentos`} variant="secondary">
              Voltar aos documentos
            </ButtonLink>
            <SubmitButton pendingLabel="Finalizando…">Finalizar atendimento</SubmitButton>
          </div>
        </form>
      </div>
    </>
  );
}

function ReviewSection({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: ReactNode;
}) {
  const id = `sec-${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  return (
    <section aria-labelledby={id}>
      <header className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h2 id={id} className="text-lg">
          {title}
        </h2>
        <Link
          href={editHref}
          className="rounded border border-line px-3 py-1 text-sm font-medium text-navy hover:border-navy print:hidden"
        >
          Corrigir<span className="sr-only"> {title}</span>
        </Link>
      </header>
      {children}
    </section>
  );
}

function Row({ term, value, muted = false }: { term: string; value: string; muted?: boolean }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[1fr_1fr] sm:gap-6">
      <dt className="text-sm text-muted">{term}</dt>
      <dd className={muted ? "text-muted" : ""}>{value}</dd>
    </div>
  );
}

function formatPhone(digits: string) {
  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

function formatCpf(digits: string) {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
