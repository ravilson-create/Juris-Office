import { z } from "zod";

/** Módulo 6 — Acompanhamento processual e alertas (Fase F6, PR3 do Portal do Advogado). */
export const processEventSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  date: z.iso.date(),
  type: z.string().min(1),
  description: z.string().min(1),
  source: z.enum(["manual", "integration"]),
});
export type ProcessEvent = z.infer<typeof processEventSchema>;

export const deadlineCountingRuleSchema = z.enum(["business_days", "calendar_days"]);
export type DeadlineCountingRule = z.infer<typeof deadlineCountingRuleSchema>;

export const deadlineStatusSchema = z.enum(["open", "done", "missed"]);
export type DeadlineStatus = z.infer<typeof deadlineStatusSchema>;

export const deadlineSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  dueDate: z.iso.date(),
  type: z.string().trim().min(1).max(160),
  countingRule: deadlineCountingRuleSchema,
  status: deadlineStatusSchema,
  // IDs de ator nesta base são texto (ver app_actor_id()/profiles.user_id), nunca uuid — ao
  // contrário do que a primeira versão deste schema (só tipos, nunca validada contra dado real)
  // assumia.
  assignedTo: z.string().min(1),
  escalatedAt: z.iso.datetime().optional(),
});
export type Deadline = z.infer<typeof deadlineSchema>;

/**
 * Soma dias corridos ou úteis a uma data, devolvendo a data sugerida do prazo. Advogado sempre
 * confirma/edita o resultado antes de salvar — nunca é gravado sem revisão.
 *
 * Limitação conhecida: "dias úteis" aqui só pula sábado e domingo. Não conhece feriados
 * nacionais, estaduais, municipais nem forenses (que variam por tribunal) — a data sugerida pode
 * cair num feriado. É a mesma ressalva já registrada no plano desta PR; entra num cálculo mais
 * completo quando houver uma fonte confiável de feriados por tribunal.
 */
export function calcularDataFinal(
  dataInicio: Date,
  quantidadeDias: number,
  regra: DeadlineCountingRule,
): Date {
  const data = new Date(dataInicio);
  if (regra === "calendar_days") {
    data.setUTCDate(data.getUTCDate() + quantidadeDias);
    return data;
  }
  let restantes = quantidadeDias;
  while (restantes > 0) {
    data.setUTCDate(data.getUTCDate() + 1);
    const diaDaSemana = data.getUTCDay(); // 0 = domingo, 6 = sábado
    if (diaDaSemana !== 0 && diaDaSemana !== 6) restantes -= 1;
  }
  return data;
}
