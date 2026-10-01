import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db/types";
import type { CaseStatus } from "@/domain/case/schema";
import { assertTransition } from "@/domain/case/status";
import type { CaseViability, FeeType } from "@/domain/contract/schema";
import { statusCasoParaDecisao } from "@/domain/contract/schema";
import { assertContractTransition } from "@/domain/contract/status";
import type { ContractStatus } from "@/domain/contract/schema";

export type ContratoRow = {
  id: string;
  case_id: string;
  fee_type: FeeType;
  fee_value_cents: string;
  success_percentage: string | null;
  status: ContractStatus;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ParcelaRow = {
  id: string;
  contract_id: string;
  due_date: string;
  amount_cents: string;
  status: "pending" | "paid" | "overdue";
};

export async function buscarViabilidade(db: Db, caseId: string): Promise<CaseViability | null> {
  const rows = await db.query<{
    case_id: string;
    feasibility_note: string;
    risk: "low" | "medium" | "high";
    decision: "accepted" | "rejected" | "needs_info";
    decided_by: string;
    decided_at: string;
  }>("SELECT * FROM case_viability WHERE case_id = $1", [caseId]);
  const r = rows[0];
  if (!r) return null;
  return {
    caseId: r.case_id,
    feasibilityNote: r.feasibility_note,
    risk: r.risk,
    decision: r.decision,
    decidedBy: r.decided_by,
    decidedAt: new Date(r.decided_at).toISOString(),
  };
}

/**
 * Registra a decisão de viabilidade e move o status do caso na mesma transação — os dois nunca
 * divergem (ver statusCasoParaDecisao). assertTransition lança se o caso não estiver numa etapa
 * de onde essa decisão é um próximo passo válido (ex.: não dá pra "aceitar" um caso em 'draft').
 */
export async function registrarViabilidade(
  db: Db,
  params: {
    caseId: string;
    feasibilityNote: string;
    risk: "low" | "medium" | "high";
    decision: "accepted" | "rejected" | "needs_info";
    decidedBy: string;
    statusAtual: CaseStatus;
  },
): Promise<void> {
  const proximoStatus = statusCasoParaDecisao(params.decision);
  assertTransition(params.statusAtual, proximoStatus);
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO case_viability(case_id, feasibility_note, risk, decision, decided_by, decided_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (case_id) DO UPDATE SET
         feasibility_note = excluded.feasibility_note, risk = excluded.risk,
         decision = excluded.decision, decided_by = excluded.decided_by, decided_at = now()`,
      [params.caseId, params.feasibilityNote, params.risk, params.decision, params.decidedBy],
    );
    await tx.query("UPDATE legal_cases SET status = $2, updated_at = now() WHERE id = $1", [
      params.caseId,
      proximoStatus,
    ]);
  });
}

export async function listarContratos(db: Db, caseId: string): Promise<ContratoRow[]> {
  return db.query<ContratoRow>(
    "SELECT * FROM contracts WHERE case_id = $1 ORDER BY created_at DESC",
    [caseId],
  );
}

export async function criarContrato(
  db: Db,
  params: {
    caseId: string;
    feeType: FeeType;
    feeValueCents: number;
    successPercentage: number | null;
    createdBy: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, success_percentage, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      randomUUID(),
      params.caseId,
      params.feeType,
      params.feeValueCents,
      params.successPercentage,
      params.createdBy,
    ],
  );
}

/** A RLS (contracts_update) já restringe a advogado/admin com acesso ao caso. */
export async function atualizarStatusContrato(
  db: Db,
  contractId: string,
  statusAtual: ContractStatus,
  proximoStatus: ContractStatus,
): Promise<void> {
  assertContractTransition(statusAtual, proximoStatus);
  await db.query("UPDATE contracts SET status = $2, updated_at = now() WHERE id = $1", [
    contractId,
    proximoStatus,
  ]);
}

export async function listarParcelas(db: Db, contractId: string): Promise<ParcelaRow[]> {
  return db.query<ParcelaRow>(
    "SELECT * FROM contract_installments WHERE contract_id = $1 ORDER BY due_date ASC",
    [contractId],
  );
}

export async function adicionarParcela(
  db: Db,
  params: { contractId: string; dueDate: string; amountCents: number },
): Promise<void> {
  await db.query(
    "INSERT INTO contract_installments(id, contract_id, due_date, amount_cents) VALUES ($1, $2, $3, $4)",
    [randomUUID(), params.contractId, params.dueDate, params.amountCents],
  );
}

export async function marcarParcelaPaga(db: Db, installmentId: string): Promise<void> {
  await db.query(
    "UPDATE contract_installments SET status = 'paid' WHERE id = $1 AND status != 'paid'",
    [installmentId],
  );
}

/** Job de manutenção (cron), mesmo padrão de escalonarPrazosVencidos: roda fora da RLS. */
export async function escalonarParcelasVencidas(db: Db): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `UPDATE contract_installments SET status = 'overdue'
     WHERE status = 'pending' AND due_date < current_date
     RETURNING id`,
  );
  return rows.length;
}
