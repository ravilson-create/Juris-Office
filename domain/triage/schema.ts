import { z } from "zod";

export const questionTypeSchema = z.enum([
  "text",
  "textarea",
  "date",
  "number",
  "currency",
  "boolean",
  "single_choice",
  "multiple_choice",
]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionOptionSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

/** Exibe a pergunta somente quando outra pergunta tiver determinada resposta. */
export const showIfSchema = z.object({
  questionKey: z.string().min(1),
  equals: z.union([z.string(), z.boolean()]),
});
export type ShowIf = z.infer<typeof showIfSchema>;

export const questionConstraintsSchema = z.object({
  notFuture: z.boolean().optional(),
  /** Limites (inclusive). Para `currency`, em reais. */
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().positive().optional(),
  /** `number`: só aceita inteiros (ex.: quantidade de filhos). */
  integer: z.boolean().optional(),
  /**
   * `date`: não pode ser anterior à resposta de outra pergunta de data (mesma etapa ou
   * anterior). Datas iguais são aceitas. `label` completa a mensagem: "…anterior à {label}".
   */
  notBefore: z.object({ key: z.string().min(1), label: z.string().min(1) }).optional(),
});
export type QuestionConstraints = z.infer<typeof questionConstraintsSchema>;

/**
 * Como a resposta alimenta o dossiê (montagem determinística, sem IA):
 * - party: a resposta (texto) é uma parte envolvida; com `fixedName`, uma resposta "sim" inclui essa parte;
 * - date: a resposta (data) vira evento da linha do tempo;
 * - amount: a resposta (valor) entra em "Valores informados";
 * - action: a resposta entra em "Providências já tomadas".
 */
export const dossierHintSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("party"), role: z.string().min(1), fixedName: z.string().optional() }),
  z.object({ kind: z.literal("date"), event: z.string().min(1) }),
  z.object({ kind: z.literal("amount"), label: z.string().min(1) }),
  z.object({ kind: z.literal("action") }),
]);
export type DossierHint = z.infer<typeof dossierHintSchema>;

export const triageQuestionSchema = z
  .object({
    id: z.uuid(),
    legalAreaId: z.uuid(),
    key: z.string().regex(/^[a-z][a-z0-9_]*$/, "chave deve ser snake_case"),
    section: z.string().min(1),
    label: z.string().min(1),
    helpText: z.string().optional(),
    type: questionTypeSchema,
    required: z.boolean(),
    options: z.array(questionOptionSchema).optional(),
    showIf: showIfSchema.optional(),
    constraints: questionConstraintsSchema.optional(),
    dossier: dossierHintSchema.optional(),
    sortOrder: z.number().int(),
    active: z.boolean(),
  })
  .refine(
    (q) =>
      !(q.type === "single_choice" || q.type === "multiple_choice") ||
      (q.options?.length ?? 0) >= 2,
    { error: "Perguntas de escolha precisam de ao menos duas opções.", path: ["options"] },
  );
export type TriageQuestion = z.infer<typeof triageQuestionSchema>;

export const answerValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
]);
export type AnswerValue = z.infer<typeof answerValueSchema>;

export const triageAnswerSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  questionId: z.uuid(),
  questionKey: z.string(),
  value: answerValueSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type TriageAnswer = z.infer<typeof triageAnswerSchema>;

/** Valores crus vindos do formulário (sempre texto ou lista de textos). */
export type RawFormValue = string | string[] | undefined;
export type RawFormValues = Record<string, RawFormValue>;
