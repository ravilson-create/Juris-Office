import { businessDate, compareCivilDates, formatCivilDate, isCivilDate } from "@/domain/time";
import { MONEY_FORMAT_ERROR, parseMoney, toCents } from "./money";
import type { AnswerValue, RawFormValue, RawFormValues, TriageQuestion } from "./schema";

export interface TriageStep {
  index: number;
  title: string;
  questions: TriageQuestion[];
}

/** Ordena perguntas ativas e agrupa por seção, na ordem de primeira aparição. */
export function buildSteps(questions: TriageQuestion[]): TriageStep[] {
  const active = questions.filter((q) => q.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const steps: TriageStep[] = [];
  for (const q of active) {
    let step = steps.find((s) => s.title === q.section);
    if (!step) {
      step = { index: steps.length, title: q.section, questions: [] };
      steps.push(step);
    }
    step.questions.push(q);
  }
  return steps;
}

export type AnswerMap = Record<string, AnswerValue>;

export function isVisible(question: TriageQuestion, answers: AnswerMap): boolean {
  if (!question.showIf) return true;
  const current = answers[question.showIf.questionKey];
  if (current === undefined) return false;
  if (Array.isArray(current)) return current.includes(String(question.showIf.equals));
  return current === question.showIf.equals;
}

function isEmpty(raw: RawFormValue): boolean {
  if (raw === undefined) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  return raw.trim() === "";
}

/**
 * Compatibilidade: valor em reais (duas casas) ou null se inválido.
 * A regra de formato fica em `parseMoney` (money.ts).
 */
export function parseCurrency(input: string): number | null {
  const r = parseMoney(input);
  return r.ok ? r.cents / 100 : null;
}

const NUMBER_FORMAT = /^\d+([.,]\d+)?$/;

type ParseResult = { ok: true; value: AnswerValue } | { ok: false; error: string };

/**
 * Converte e valida uma resposta do formulário.
 * `context` traz respostas já válidas de outras perguntas (regras entre campos, como `notBefore`).
 */
export function parseAnswer(
  q: TriageQuestion,
  raw: RawFormValue,
  today = new Date(),
  context: AnswerMap = {},
): ParseResult {
  const c = q.constraints ?? {};
  switch (q.type) {
    case "text":
    case "textarea": {
      const v = String(raw).trim();
      const max = c.maxLength ?? (q.type === "text" ? 200 : 4000);
      if (v.length > max) return { ok: false, error: `Use no máximo ${max} caracteres.` };
      return { ok: true, value: v };
    }
    case "date": {
      const value = String(raw).trim();
      if (!isCivilDate(value)) return { ok: false, error: "Informe uma data válida." };
      // "Hoje" é o dia civil no fuso de negócio, não em UTC.
      if (c.notFuture && compareCivilDates(value, businessDate(today)) > 0) {
        return { ok: false, error: "A data não pode estar no futuro." };
      }
      const ref = c.notBefore ? context[c.notBefore.key] : undefined;
      if (c.notBefore && typeof ref === "string" && compareCivilDates(value, ref) < 0) {
        return {
          ok: false,
          error: `Esta data não pode ser anterior à ${c.notBefore.label} (${formatCivilDate(ref)}).`,
        };
      }
      return { ok: true, value };
    }
    case "currency": {
      const r = parseMoney(String(raw));
      if (!r.ok) return { ok: false, error: r.error };
      if (r.cents < toCents(c.min ?? 0)) {
        return { ok: false, error: `O valor mínimo é ${formatMoney(c.min ?? 0)}.` };
      }
      if (c.max !== undefined && r.cents > toCents(c.max)) {
        return { ok: false, error: `O valor máximo é ${formatMoney(c.max)}.` };
      }
      return { ok: true, value: r.cents / 100 };
    }
    case "number": {
      const v = String(raw).trim();
      if (c.integer && !/^\d+$/.test(v)) {
        return /^\d+[.,]\d+$/.test(v)
          ? { ok: false, error: "Informe um número inteiro, sem vírgula ou casas decimais." }
          : { ok: false, error: "Informe um número inteiro." };
      }
      if (!NUMBER_FORMAT.test(v)) return { ok: false, error: "Informe um número." };
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n)) return { ok: false, error: "Informe um número." };
      const min = c.min ?? 0;
      if (n < min || (c.max !== undefined && n > c.max)) {
        return {
          ok: false,
          error:
            c.max !== undefined
              ? `Informe um número entre ${min} e ${c.max}.`
              : `O valor mínimo é ${min}.`,
        };
      }
      return { ok: true, value: n };
    }
    case "boolean": {
      if (raw === "sim") return { ok: true, value: true };
      if (raw === "nao") return { ok: true, value: false };
      return { ok: false, error: "Escolha sim ou não." };
    }
    case "single_choice": {
      const allowed = q.options?.map((o) => o.value) ?? [];
      if (typeof raw !== "string" || !allowed.includes(raw)) {
        return { ok: false, error: "Escolha uma das opções." };
      }
      return { ok: true, value: raw };
    }
    case "multiple_choice": {
      const allowed = q.options?.map((o) => o.value) ?? [];
      const list = Array.isArray(raw) ? raw : [String(raw)];
      if (list.some((v) => !allowed.includes(v))) {
        return { ok: false, error: "Escolha apenas opções da lista." };
      }
      return { ok: true, value: list };
    }
  }
}

export interface StepValidation {
  valid: boolean;
  values: AnswerMap;
  /** Chaves de perguntas que ficaram ocultas e cujas respostas devem ser descartadas. */
  hiddenKeys: string[];
  errors: Record<string, string>;
}

/**
 * Valida as respostas de uma etapa.
 * `previous` são respostas já salvas (de outras etapas) usadas nas regras de visibilidade.
 */
export function validateStep(
  questions: TriageQuestion[],
  raw: RawFormValues,
  previous: AnswerMap = {},
  today = new Date(),
): StepValidation {
  const values: AnswerMap = {};
  const errors: Record<string, string> = {};
  const hiddenKeys: string[] = [];
  const context: AnswerMap = { ...previous };

  for (const q of questions) {
    if (!isVisible(q, context)) {
      hiddenKeys.push(q.key);
      delete context[q.key];
      continue;
    }
    const input = raw[q.key];
    if (isEmpty(input)) {
      if (q.required) errors[q.key] = "Responda esta pergunta para continuar.";
      delete context[q.key];
      continue;
    }
    const result = parseAnswer(q, input, today, context);
    if (result.ok) {
      values[q.key] = result.value;
      context[q.key] = result.value;
    } else {
      errors[q.key] = result.error;
    }
  }
  return { valid: Object.keys(errors).length === 0, values, hiddenKeys, errors };
}

/** Converte a resposta salva de volta ao formato do formulário (retomar/editar). */
export function toFormValue(q: TriageQuestion, value: AnswerValue | undefined): RawFormValue {
  if (value === undefined) return q.type === "multiple_choice" ? [] : "";
  switch (q.type) {
    case "boolean":
      return value === true ? "sim" : value === false ? "nao" : "";
    case "currency":
      return typeof value === "number" ? formatNumberBR(value) : String(value);
    case "multiple_choice":
      return Array.isArray(value) ? value : [String(value)];
    default:
      return String(value);
  }
}

function formatMoney(reais: number): string {
  return reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumberBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Texto legível da resposta, para revisão e dossiê. */
export function formatAnswer(q: TriageQuestion, value: AnswerValue | undefined): string {
  if (value === undefined || value === "") return "Não informado";
  switch (q.type) {
    case "boolean":
      return value ? "Sim" : "Não";
    case "currency":
      return typeof value === "number"
        ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : String(value);
    case "date":
      return formatCivilDate(String(value));
    case "single_choice":
      return q.options?.find((o) => o.value === value)?.label ?? String(value);
    case "multiple_choice": {
      const list = Array.isArray(value) ? value : [String(value)];
      return list.map((v) => q.options?.find((o) => o.value === v)?.label ?? v).join(", ");
    }
    default:
      return String(value);
  }
}

export interface Reconciliation {
  /** Respostas visíveis e válidas — as únicas que revisão, dossiê e envio podem usar. */
  answers: AnswerMap;
  /** Chaves cujas perguntas ficaram ocultas: as respostas devem ser apagadas. */
  hidden: string[];
  /** Respostas visíveis que não passam mais nas regras (ex.: datas incoerentes). */
  invalid: Record<string, string>;
}

/**
 * Reavalia todas as respostas do caso, em todas as etapas.
 * - Visibilidade é recalculada até estabilizar, cobrindo dependências encadeadas
 *   (A oculta B, que por sua vez oculta C).
 * - Respostas salvas são revalidadas com as mesmas regras do formulário, incluindo as
 *   regras entre campos.
 * Resposta oculta nunca "volta" sozinha: quem chama deve apagar `hidden`.
 */
export function reconcileAnswers(
  questions: TriageQuestion[],
  answers: AnswerMap,
  today = new Date(),
): Reconciliation {
  const ordered = questions.filter((q) => q.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const current: AnswerMap = { ...answers };
  const hidden = new Set<string>();
  for (let round = 0; round <= ordered.length; round++) {
    let changed = false;
    for (const q of ordered) {
      if (current[q.key] !== undefined && !isVisible(q, current)) {
        delete current[q.key];
        hidden.add(q.key);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const valid: AnswerMap = {};
  const invalid: Record<string, string> = {};
  for (const q of ordered) {
    const value = current[q.key];
    if (value === undefined) continue;
    const r = parseAnswer(q, toFormValue(q, value), today, valid);
    if (r.ok) valid[q.key] = r.value;
    else invalid[q.key] = r.error;
  }
  return { answers: valid, hidden: [...hidden], invalid };
}

/**
 * Detecta ciclos nas condições de exibição (A depende de B que depende de A).
 * Retorna o caminho do ciclo ou null. Configurações com ciclo devem ser recusadas.
 */
export function findConditionalCycle(questions: TriageQuestion[]): string[] | null {
  const deps = new Map(questions.map((q) => [q.key, q.showIf?.questionKey]));
  for (const start of deps.keys()) {
    const path: string[] = [];
    let k: string | undefined = start;
    while (k !== undefined) {
      if (path.includes(k)) return [...path.slice(path.indexOf(k)), k];
      path.push(k);
      k = deps.get(k);
    }
  }
  return null;
}

/** Percentual de perguntas obrigatórias visíveis com resposta válida. */
export function completion(
  questions: TriageQuestion[],
  answers: AnswerMap,
  today = new Date(),
): number {
  const r = reconcileAnswers(questions, answers, today);
  const required = questions.filter((q) => q.active && q.required && isVisible(q, r.answers));
  if (required.length === 0) return 100;
  const done = required.filter((q) => r.answers[q.key] !== undefined).length;
  return Math.round((done / required.length) * 100);
}

/**
 * Etapa completa = toda pergunta visível obrigatória tem resposta válida, e nenhuma resposta
 * visível da etapa está inválida. Recebe as respostas já reconciliadas.
 */
function stepComplete(step: TriageStep, r: Reconciliation): boolean {
  return step.questions.every((q) => {
    if (!isVisible(q, r.answers)) return true;
    if (r.invalid[q.key]) return false;
    return !q.required || r.answers[q.key] !== undefined;
  });
}

/** Índice da primeira etapa incompleta; igual a steps.length quando tudo está válido. */
export function firstIncompleteStep(
  steps: TriageStep[],
  answers: AnswerMap,
  today = new Date(),
): number {
  const r = reconcileAnswers(
    steps.flatMap((s) => s.questions),
    answers,
    today,
  );
  const i = steps.findIndex((s) => !stepComplete(s, r));
  return i === -1 ? steps.length : i;
}
