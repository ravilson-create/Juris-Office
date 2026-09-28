"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { saveApplicantAction } from "@/app/atendimento/actions";
import {
  applicantSchema,
  BRAZIL_UFS,
  type Applicant,
  type ApplicantInput,
} from "@/domain/case/schema";
import { Alert } from "@/components/ui/alert";
import { DraftStatus } from "@/components/draft/draft-status";
import { useDraftAutosave } from "@/components/draft/use-draft-autosave";
import { safeCall } from "@/lib/utils/safe-call";
import { Button } from "@/components/ui/button";
import { describedBy, ErrorText, fieldIds, HelpText, inputClass } from "@/components/ui/field";

type FormValues = Omit<ApplicantInput, "uf" | "consentAccepted"> & {
  uf: string;
  consentAccepted: boolean;
};

const LABELS: Record<keyof FormValues, string> = {
  fullName: "Nome completo",
  email: "E-mail",
  phone: "Telefone com DDD",
  city: "Cidade",
  uf: "Estado (UF)",
  consentAccepted: "Ciência sobre o uso dos dados",
};

export function IdentificationForm({
  caseId,
  defaultValues,
  returnTo,
  draftBaseTime,
  restoredDraft = false,
}: {
  caseId: string;
  defaultValues: FormValues;
  draftBaseTime: string;
  restoredDraft?: boolean;
  /** Para onde voltar após salvar (ex.: revisão). Padrão: triagem. */
  returnTo?: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, Applicant>({
    resolver: zodResolver(applicantSchema) as never,
    defaultValues,
    shouldFocusError: true,
  });

  const draft = useDraftAutosave({
    caseId,
    scope: "identificacao",
    baseTime: draftBaseTime,
    values: watch(),
  });

  const onSubmit = async (values: Applicant) => {
    setFormError(null);
    await draft.stop();
    const result = await safeCall(() => saveApplicantAction(caseId, values, Boolean(returnTo)));
    // Sucesso: o servidor já redirecionou; só chegamos aqui com falha.
    if (!result || result.ok) return;
    draft.resume();
    setFormError(result.message);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as keyof FormValues, { message });
    }
  };

  const text = (
    name: Exclude<keyof FormValues, "consentAccepted" | "uf">,
    props: {
      type?: string;
      autoComplete?: string;
      inputMode?: "email" | "tel" | "text";
      help?: string;
    },
  ) => {
    const ids = fieldIds(name);
    const error = errors[name]?.message;
    return (
      <div>
        <label htmlFor={ids.input} className="block font-medium">
          {LABELS[name]}
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        </label>
        <HelpText name={name}>{props.help}</HelpText>
        <input
          id={ids.input}
          type={props.type ?? "text"}
          autoComplete={props.autoComplete}
          inputMode={props.inputMode}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(name, Boolean(props.help), Boolean(error))}
          className={`${inputClass} mt-1.5`}
          {...register(name)}
        />
        <ErrorText name={name} message={error} />
      </div>
    );
  };

  const ufError = errors.uf?.message;
  const consentError = errors.consentAccepted?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-6">
      {restoredDraft && (
        <Alert title="Rascunho restaurado">
          Recuperamos dados que você começou a preencher e ainda não tinha salvo. Revise e salve
          para continuar.
        </Alert>
      )}
      <ErrorSummary errors={errors} formError={formError} />
      {text("fullName", { autoComplete: "name" })}
      {text("email", { type: "email", autoComplete: "email", inputMode: "email" })}
      {text("phone", {
        type: "tel",
        autoComplete: "tel",
        inputMode: "tel",
        help: "Exemplo: (11) 91234-5678",
      })}
      <div className="grid gap-6 sm:grid-cols-[1fr_10rem]">
        {text("city", { autoComplete: "address-level2" })}
        <div>
          <label htmlFor={fieldIds("uf").input} className="block font-medium">
            {LABELS.uf}
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id={fieldIds("uf").input}
            autoComplete="address-level1"
            aria-required="true"
            aria-invalid={ufError ? true : undefined}
            aria-describedby={describedBy("uf", false, Boolean(ufError))}
            className={`${inputClass} mt-1.5`}
            {...register("uf")}
          >
            <option value="">Selecione</option>
            {BRAZIL_UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
          <ErrorText name="uf" message={ufError} />
        </div>
      </div>

      <div className="rounded-md border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <input
            id={fieldIds("consentAccepted").input}
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 accent-navy"
            aria-invalid={consentError ? true : undefined}
            aria-describedby={describedBy("consentAccepted", false, Boolean(consentError))}
            {...register("consentAccepted")}
          />
          <label htmlFor={fieldIds("consentAccepted").input} className="text-sm">
            Estou ciente de que esta é uma versão de testes, de que devo usar dados fictícios e de
            que as informações serão usadas somente para montar o dossiê de demonstração deste
            atendimento, sem encaminhamento a advogados, conforme a{" "}
            <a href="/privacidade" target="_blank" className="text-navy underline">
              política de privacidade
            </a>
            .
          </label>
        </div>
        <ErrorText name="consentAccepted" message={consentError} />
      </div>

      <DraftStatus state={draft.state} onRetry={() => void draft.retry()} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar e continuar"}
        </Button>
      </div>
    </form>
  );
}

function ErrorSummary({
  errors,
  formError,
}: {
  errors: FieldErrors<FormValues>;
  formError: string | null;
}) {
  const entries = Object.entries(errors).filter(([, e]) => e?.message) as Array<
    [keyof FormValues, { message?: string }]
  >;
  if (!formError && entries.length === 0) return null;
  return (
    <Alert tone="error" title={formError ?? "Revise os campos abaixo."}>
      {entries.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {entries.map(([name, e]) => (
            <li key={name}>
              <a href={`#${fieldIds(name).input}`} className="underline">
                {LABELS[name]}: {e.message}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
