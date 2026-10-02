import { z } from "zod";
import type { CaseStatus } from "@/domain/case/schema";

/** Módulo 3 — Fechamento de contrato (Fase F2, PR4 do Portal do Advogado). */
export const feeTypeSchema = z.enum(["fixed", "success", "hourly", "mixed"]);
export type FeeType = z.infer<typeof feeTypeSchema>;

export const contractStatusSchema = z.enum(["draft", "sent", "signed", "cancelled"]);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

export const contractSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  feeType: feeTypeSchema,
  /** Centavos inteiros (mesma convenção de domain/triage/money.ts), nunca reais fracionados. */
  feeValue: z.number().int().nonnegative(),
  successPercentage: z.number().min(0).max(100).optional(),
  status: contractStatusSchema,
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
  /** Centavos inteiros. */
  amount: z.number().int().positive(),
  status: z.enum(["pending", "paid", "overdue"]),
});
export type Installment = z.infer<typeof installmentSchema>;

/**
 * Trilha de auditoria do aceite eletrônico (Fase F2, PR5). `signedBy`/`signedByHash` espelham o
 * mesmo modelo dual de dono de caso usado em `owns_case()`: conta logada quando houver, senão o
 * hash da sessão anônima — exatamente um dos dois é preenchido, nunca os dois nem nenhum.
 */
export const contractSignatureSchema = z.object({
  id: z.uuid(),
  contractId: z.uuid(),
  signedBy: z.string().min(1).nullable(),
  signedByHash: z.string().min(1).nullable(),
  signedAt: z.iso.datetime(),
  ip: z.string().min(1),
  userAgent: z.string().min(1),
  signatureHash: z.string().min(1),
});
export type ContractSignature = z.infer<typeof contractSignatureSchema>;

export const caseViabilitySchema = z.object({
  caseId: z.uuid(),
  feasibilityNote: z.string().trim().min(1),
  risk: z.enum(["low", "medium", "high"]),
  decision: z.enum(["accepted", "rejected", "needs_info"]),
  // ID de ator nesta base é texto (profiles.user_id), nunca uuid — mesma correção já feita em
  // domain/deadline/schema.ts (assignedTo): o tipo original nunca tinha sido validado contra
  // dado real porque o módulo nunca foi implementado.
  decidedBy: z.string().min(1),
  decidedAt: z.iso.datetime(),
});
export type CaseViability = z.infer<typeof caseViabilitySchema>;

/**
 * A decisão de viabilidade não fica num status à parte: ela move o próprio status do caso
 * (domain/case/status.ts já prevê under_legal_review/needs_information → accepted/rejected →
 * in_negotiation). Dois conceitos de "status do caso" que pudessem divergir seria pior do que
 * um só — por isso a decisão de viabilidade é sempre também uma transição de CaseStatus,
 * validada por assertTransition antes de gravar.
 */
export function statusCasoParaDecisao(decision: CaseViability["decision"]): CaseStatus {
  switch (decision) {
    case "accepted":
      return "accepted";
    case "rejected":
      return "rejected";
    case "needs_info":
      return "needs_information";
  }
}
