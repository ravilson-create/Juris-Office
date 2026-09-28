"use client";

import type { UseFormRegister } from "react-hook-form";
import {
  describedBy,
  ErrorText,
  fieldIds,
  HelpText,
  inputClass,
  RequiredMark,
} from "@/components/ui/field";
import type { RawFormValues, TriageQuestion } from "@/domain/triage/schema";

interface Props {
  question: TriageQuestion;
  register: UseFormRegister<RawFormValues>;
  /** Campos a revalidar quando este muda (ex.: início → término). */
  deps?: string[];
  error?: string;
}

/** Renderiza um campo conforme o tipo definido nos dados da pergunta. */
export function QuestionField({ question: q, register, error, deps }: Props) {
  const reg = () => register(q.key, deps?.length ? { deps } : undefined);
  const ids = fieldIds(q.key);
  const aria = {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(q.key, Boolean(q.helpText), Boolean(error)),
    "aria-required": q.required || undefined,
  } as const;

  if (q.type === "boolean" || q.type === "single_choice" || q.type === "multiple_choice") {
    const options =
      q.type === "boolean"
        ? [
            { label: "Sim", value: "sim" },
            { label: "Não", value: "nao" },
          ]
        : (q.options ?? []);
    const inputType = q.type === "multiple_choice" ? "checkbox" : "radio";
    return (
      <fieldset aria-describedby={aria["aria-describedby"]} aria-invalid={aria["aria-invalid"]}>
        <legend className="font-medium">
          {q.label}
          <RequiredMark required={q.required} />
        </legend>
        <HelpText name={q.key}>{q.helpText}</HelpText>
        <div className={`mt-3 flex gap-2 ${q.type === "boolean" ? "flex-row" : "flex-col"}`}>
          {options.map((opt, i) => {
            const id = `${ids.input}-${i}`;
            return (
              <label
                key={opt.value}
                htmlFor={id}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border bg-surface px-4 py-2.5 has-[:checked]:border-navy has-[:checked]:bg-navy-soft ${
                  error ? "border-danger" : "border-line"
                } ${q.type === "boolean" ? "flex-1 sm:flex-none sm:min-w-32" : ""}`}
              >
                <input
                  id={id}
                  type={inputType}
                  value={opt.value}
                  className="h-5 w-5 accent-navy"
                  {...reg()}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
        <ErrorText name={q.key} message={error} />
      </fieldset>
    );
  }

  const common = { id: ids.input, className: `${inputClass} mt-1.5`, ...aria, ...reg() };

  return (
    <div>
      <label htmlFor={ids.input} className="block font-medium">
        {q.label}
        <RequiredMark required={q.required} />
      </label>
      <HelpText name={q.key}>{q.helpText}</HelpText>
      {q.type === "textarea" ? (
        <textarea rows={5} maxLength={q.constraints?.maxLength} {...common} />
      ) : q.type === "date" ? (
        <input type="date" {...common} className={`${common.className} sm:max-w-56`} />
      ) : q.type === "currency" ? (
        <div className="relative mt-1.5 sm:max-w-56">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
            aria-hidden="true"
          >
            R$
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            {...common}
            className={`${inputClass} pl-10`}
          />
        </div>
      ) : q.type === "number" ? (
        <input
          type="text"
          inputMode="numeric"
          {...common}
          className={`${common.className} sm:max-w-40`}
        />
      ) : (
        <input type="text" maxLength={q.constraints?.maxLength ?? 200} {...common} />
      )}
      <ErrorText name={q.key} message={error} />
    </div>
  );
}
