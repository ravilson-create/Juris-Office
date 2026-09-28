import { z } from "zod";

/**
 * Módulo 3 — Fechamento de contrato (Fase F2).
 * Somente tipos nesta fase; nenhuma regra implementada ainda.
 */
export const feeTypeSchema = z.enum(["fixed", "success", "hourly", "mixed"]);
export type FeeType = z.infer<typeof feeTypeSchema>;

export const contractSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  feeType: feeTypeSchema,
  feeValue: z.number().nonnegative(),
  successPercentage: z.number().min(0).max(100).optional(),
  status: z.enum(["draft", "sent", "signed", "cancelled"]),
  signedAt: z.iso.datetime().optional(),
  signatureHash: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Contract = z.infer<typeof contractSchema>;

export const installmentSchema = z.object({
  id: z.uuid(),
  contractId: z.uuid(),
  dueDate: z.iso.date(),
  amount: z.number().positive(),
  status: z.enum(["pending", "paid", "overdue"]),
});
export type Installment = z.infer<typeof installmentSchema>;

export const caseViabilitySchema = z.object({
  caseId: z.uuid(),
  feasibilityNote: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  decision: z.enum(["accepted", "rejected", "needs_info"]),
  decidedBy: z.uuid(),
  decidedAt: z.iso.datetime(),
});
export type CaseViability = z.infer<typeof caseViabilitySchema>;
