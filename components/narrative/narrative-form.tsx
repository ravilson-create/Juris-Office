"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { saveNarrativeAction } from "@/app/atendimento/actions";
import { DraftStatus } from "@/components/draft/draft-status";
import { useDraftAutosave } from "@/components/draft/use-draft-autosave";
import { Alert } from "@/components/ui/alert";
import { safeCall } from "@/lib/utils/safe-call";
import { Button, ButtonLink } from "@/components/ui/button";
import { describedBy, ErrorText, fieldIds, inputClass } from "@/components/ui/field";
import {
  NARRATIVE_GUIDANCE,
  NARRATIVE_MAX,
  NARRATIVE_MIN,
  narrativeSchema,
  type NarrativeInput,
} from "@/domain/case/narrative";

export function NarrativeForm({
  caseId,
  defaultValue,
  backHref,
  returnTo,
  draftBaseTime,
  restoredDraft = false,
}: {
  caseId: string;
  defaultValue: string;
  backHref: string;
  /** Após salvar, volta para cá (ex.: revisão) em vez de ir para documentos. */
  returnTo?: string;
  draftBaseTime: string;
  restoredDraft?: boolean;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NarrativeInput>({
    resolver: zodResolver(narrativeSchema) as never,
    defaultValues: { narrative: defaultValue },
    shouldFocusError: true,
  });

  const text = watch("narrative") ?? "";
  const length = text.trim().length;
  const draft = useDraftAutosave({
    caseId,
    scope: "relato",
    baseTime: draftBaseTime,
    values: { narrative: text },
  });
  const error = errors.narrative?.message;
  const ids = fieldIds("narrative");
  const counterId = "f-narrative-contador";

  const onSubmit = async (values: NarrativeInput) => {
    setFormError(null);
    await draft.stop();
    const result = await safeCall(() => saveNarrativeAction(caseId, values, Boolean(returnTo)));
    // Sucesso: o servidor já redirecionou; só chegamos aqui com falha.
    if (!result || result.ok) return;
    draft.resume();
    setFormError(result.message);
    if (result.fieldErrors?.narrative)
      setError("narrative", { message: result.fieldErrors.narrative });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-6">
      {restoredDraft && (
        <Alert title="Rascunho restaurado">
          Recuperamos o texto que você começou e ainda não tinha salvo. Revise e salve para concluir
          o relato.
        </Alert>
      )}
      {formError && (
        <Alert tone="error" title={formError}>
          Não foi possível salvar o relato.
        </Alert>
      )}
      <div>
        <label htmlFor={ids.input} className="block text-lg font-semibold">
          O que aconteceu?
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        </label>
        <p id={ids.help} className="mt-1 max-w-prose text-muted">
          {NARRATIVE_GUIDANCE}
        </p>
        <textarea
          id={ids.input}
          rows={12}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={[describedBy("narrative", true, Boolean(error)), counterId].join(" ")}
          className={`${inputClass} mt-3 min-h-64 resize-y leading-relaxed`}
          {...register("narrative")}
        />
        <p
          id={counterId}
          className={`mt-1.5 text-sm tabular-nums ${length > NARRATIVE_MAX ? "font-medium text-danger" : "text-muted"}`}
        >
          {length.toLocaleString("pt-BR")} de {NARRATIVE_MAX.toLocaleString("pt-BR")} caracteres
          {length < NARRATIVE_MIN ? ` (mínimo ${NARRATIVE_MIN})` : ""}
        </p>
        <ErrorText name="narrative" message={error} />
      </div>

      <p className="max-w-prose text-sm text-muted">
        Escreva com suas palavras, sem se preocupar com termos jurídicos. Evite incluir senhas ou
        números completos de cartão e conta bancária.
      </p>

      <DraftStatus state={draft.state} onRetry={() => void draft.retry()} />

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
        <ButtonLink href={backHref} variant="secondary">
          Voltar
        </ButtonLink>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Salvando…"
            : returnTo
              ? "Salvar e voltar à revisão"
              : "Salvar e ir para documentos"}
        </Button>
      </div>
    </form>
  );
}
