"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { saveTriageStepAction } from "@/app/atendimento/actions";
import { Alert } from "@/components/ui/alert";
import { safeCall } from "@/lib/utils/safe-call";
import { Button, ButtonLink } from "@/components/ui/button";
import { validateStep, type AnswerMap } from "@/domain/triage/engine";
import type { RawFormValues, TriageQuestion } from "@/domain/triage/schema";
import { DraftStatus } from "@/components/draft/draft-status";
import { useDraftAutosave } from "@/components/draft/use-draft-autosave";
import { triageDraftScope } from "@/domain/draft";
import { QuestionField } from "./question-field";

interface Props {
  caseId: string;
  stepIndex: number;
  totalSteps: number;
  questions: TriageQuestion[];
  defaultValues: RawFormValues;
  previousAnswers: AnswerMap;
  /** Após salvar, volta para cá (ex.: revisão) em vez de seguir para a próxima parte. */
  returnTo?: string;
  /** Instante (servidor) do carregamento da página; protege contra rascunhos atrasados. */
  draftBaseTime: string;
  /** Verdadeiro quando `defaultValues` vieram de um rascunho não concluído. */
  restoredDraft?: boolean;
  /** Respostas gravadas que não passam mais nas regras (exibidas ao abrir a etapa). */
  initialErrors?: Record<string, string>;
}

export function TriageStepForm({
  caseId,
  stepIndex,
  totalSteps,
  questions,
  defaultValues,
  previousAnswers,
  returnTo,
  draftBaseTime,
  restoredDraft = false,
  initialErrors = {},
}: Props) {
  const [formError, setFormError] = useState<string | null>(null);

  // A mesma regra de validação roda no navegador e no servidor.
  const resolver = useMemo<Resolver<RawFormValues>>(
    () => async (values) => {
      const result = validateStep(questions, values, previousAnswers);
      if (result.valid) return { values, errors: {} };
      return {
        values: {},
        errors: Object.fromEntries(
          Object.entries(result.errors).map(([k, message]) => [k, { type: "validate", message }]),
        ),
      };
    },
    [questions, previousAnswers],
  );

  const { register, handleSubmit, watch, setError, formState } = useForm<RawFormValues>({
    defaultValues,
    resolver,
    shouldFocusError: true,
    shouldUnregister: false,
  });

  // Respostas gravadas que deixaram de valer (ex.: início corrigido em outra visita).
  useEffect(() => {
    for (const [key, message] of Object.entries(initialErrors)) setError(key, { message });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir a etapa
  }, []);

  // Revalida datas relacionadas: mudar o início revalida o término.
  const depsByKey = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const q of questions) {
      const ref = q.constraints?.notBefore?.key;
      if (ref && questions.some((x) => x.key === ref)) (map[ref] ??= []).push(q.key);
    }
    return map;
  }, [questions]);

  const current = watch();
  const draft = useDraftAutosave({
    caseId,
    scope: triageDraftScope(stepIndex),
    baseTime: draftBaseTime,
    values: current,
  });
  const hidden = new Set(validateStep(questions, current, previousAnswers).hiddenKeys);
  const visibleQuestions = questions.filter((q) => !hidden.has(q.key));
  const isLast = stepIndex === totalSteps - 1;

  // Um rascunho salvo com sucesso prova que a sessão voltou a ser reconhecida — o aviso de erro
  // do envio oficial anterior (ex.: falha passageira de rede/cookie) ficaria preso na tela para
  // sempre sem isso, mesmo já não refletindo mais o estado atual.
  useEffect(() => {
    if (draft.state.kind === "saved") setFormError(null);
  }, [draft.state]);

  const onSubmit = async (values: RawFormValues) => {
    setFormError(null);
    const payload = Object.fromEntries(Object.entries(values).filter(([k]) => !hidden.has(k)));
    await draft.stop(); // nenhum rascunho atrasado pode chegar depois da gravação oficial
    const result = await safeCall(() =>
      saveTriageStepAction(caseId, stepIndex, payload, Boolean(returnTo)),
    );
    // Sucesso: o servidor já redirecionou; só chegamos aqui com falha.
    if (!result || result.ok) return;
    draft.resume();
    setFormError(result.message);
    for (const [key, message] of Object.entries(result.fieldErrors ?? {}))
      setError(key, { message });
  };

  const errorCount = Object.keys(formState.errors).length;
  const backHref =
    stepIndex === 0
      ? `/atendimento/${caseId}/identificacao`
      : `/atendimento/${caseId}/triagem?etapa=${stepIndex}`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-8">
      {restoredDraft && (
        <Alert title="Rascunho restaurado">
          Recuperamos respostas que você começou a preencher e ainda não tinha salvo. Revise e salve
          para concluir esta parte.
        </Alert>
      )}
      {(formError || errorCount > 0) && (
        <Alert tone="error" title={formError ?? "Algumas respostas precisam de ajuste."}>
          {errorCount === 1
            ? "1 pergunta está destacada abaixo."
            : `${errorCount} perguntas estão destacadas abaixo.`}
        </Alert>
      )}

      {visibleQuestions.map((q) => (
        <QuestionField
          key={q.key}
          question={q}
          register={register}
          deps={depsByKey[q.key]}
          error={formState.errors[q.key]?.message}
        />
      ))}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
        <ButtonLink href={backHref} variant="secondary">
          Voltar
        </ButtonLink>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting
            ? "Salvando…"
            : returnTo
              ? "Salvar e voltar à revisão"
              : isLast
                ? "Salvar e ir para o relato"
                : "Salvar e continuar"}
        </Button>
      </div>
      <DraftStatus state={draft.state} onRetry={() => void draft.retry()} />
    </form>
  );
}
