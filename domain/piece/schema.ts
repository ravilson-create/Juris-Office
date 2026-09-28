import { z } from "zod";

/** Módulo 5 — Produção de peças processuais (Fase F4). Somente tipos nesta fase. */
export const legalPieceSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  type: z.enum([
    "initial_petition",
    "answer",
    "appeal",
    "motion",
    "statement",
    "extrajudicial_notice",
  ]),
  templateId: z.uuid().optional(),
  status: z.enum(["draft", "in_review", "approved", "filed"]),
  version: z.number().int().positive(),
  authorId: z.uuid(),
  aiAssisted: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type LegalPiece = z.infer<typeof legalPieceSchema>;
