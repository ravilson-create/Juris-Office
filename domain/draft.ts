import { z } from "zod";

/**
 * Rascunho de um formulário ainda não concluído (Sprint 4.1).
 * Fica separado das respostas oficiais: nunca conta como etapa concluída nem entra na
 * revisão, no dossiê ou na finalização. É apagado quando a parte correspondente é salva.
 */
export const draftScopeSchema = z.union([
  z.literal("identificacao"),
  z.literal("relato"),
  z.string().regex(/^triagem:(\d|[1-4]\d)$/),
]);
export type DraftScope = z.infer<typeof draftScopeSchema>;

export const triageDraftScope = (stepIndex: number): DraftScope => `triagem:${stepIndex}`;

/** Validação leve (formato e tamanho), sem regras de preenchimento: rascunho pode estar incompleto. */
export const draftValuesSchema = z
  .record(
    z.string().max(64),
    z.union([z.string().max(10_000), z.array(z.string().max(200)).max(50), z.boolean()]),
  )
  .refine((v) => Object.keys(v).length <= 100, "Rascunho grande demais.")
  .refine((v) => JSON.stringify(v).length <= 64_000, "Rascunho grande demais.");
export type DraftValues = z.infer<typeof draftValuesSchema>;

export const draftMetaSchema = z.object({
  /** Identifica a instância do formulário (uma por carregamento da página). */
  formKey: z.uuid(),
  /** Sequência crescente dentro da mesma instância: descarta respostas fora de ordem. */
  seq: z.number().int().nonnegative().max(1_000_000),
  /** Instante (do servidor) em que a página foi carregada. */
  baseTime: z.iso.datetime(),
});
export type DraftMeta = z.infer<typeof draftMetaSchema>;

export interface DraftRecord extends DraftMeta {
  caseId: string;
  scope: DraftScope;
  values: DraftValues;
  savedAt: string;
}

/**
 * Decide se um rascunho recebido pode substituir o gravado.
 * - Página carregada antes da última gravação oficial desta parte → desatualizado.
 * - Mesma instância do formulário → só aceita sequência maior (respostas fora de ordem).
 * - Outra instância (outra aba/recarga) → só aceita se foi carregada depois da gravada.
 */
export function acceptsDraft(
  incoming: DraftMeta,
  existing: DraftMeta | undefined,
  committedAt: string | undefined,
): boolean {
  if (committedAt && incoming.baseTime < committedAt) return false;
  if (!existing) return true;
  if (existing.formKey === incoming.formKey) return incoming.seq > existing.seq;
  return incoming.baseTime >= existing.baseTime;
}
