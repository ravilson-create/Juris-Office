import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Db } from "@/lib/db/types";
import type { CaseStatus } from "@/domain/case/schema";
import { assertTransition } from "@/domain/case/status";
import type { CaseViability, ContractContent, FeeType } from "@/domain/contract/schema";
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
  content: ContractContent;
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
 * Primeira vez que um advogado/admin abre um caso recém-finalizado: entra oficialmente em
 * análise. Sem isto, nada move o caso de "submitted" para "under_legal_review" — e a decisão de
 * viabilidade só é uma transição válida a partir de "under_legal_review" (ver TRANSITIONS em
 * domain/case/status.ts) — então a decisão nunca poderia ser registrada. Chamado junto com o
 * registro de leitura (ver app/equipe/[caseId]/page.tsx e lib/services/auditoria.ts).
 */
export async function iniciarAnaliseSeNecessario(
  db: Db,
  caseId: string,
  statusAtual: CaseStatus,
): Promise<CaseStatus> {
  if (statusAtual !== "submitted") return statusAtual;
  await db.query(
    "UPDATE legal_cases SET status = 'under_legal_review', updated_at = now() WHERE id = $1 AND status = 'submitted'",
    [caseId],
  );
  return "under_legal_review";
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

/**
 * Entre os atendimentos informados, quais têm contrato com status 'sent' — enviado pelo
 * advogado e ainda não assinado pelo cliente. Usado em "Meus atendimentos" para avisar o
 * cliente sem ele precisar abrir o dossiê de cada um pra descobrir.
 */
export async function listarCasosComContratoPendente(
  db: Db,
  caseIds: readonly string[],
): Promise<Set<string>> {
  if (caseIds.length === 0) return new Set();
  const rows = await db.query<{ case_id: string }>(
    "SELECT DISTINCT case_id FROM contracts WHERE status = 'sent' AND case_id = ANY($1::uuid[])",
    [caseIds],
  );
  return new Set(rows.map((r) => r.case_id));
}

export type ContratoEquipeRow = ContratoRow & {
  protocol: string;
  title: string | null;
  legal_area_id: string;
};

/** Aba "Contratos" da área profissional: todos os contratos dos casos que o ator enxerga — a
 * mesma política de RLS de `contracts`/`legal_cases` (can_read_case) decide o que aparece, sem
 * filtro explícito de escritório ou advogado aqui (mesmo padrão de equipe-fila.ts). */
export async function listarContratosEquipe(db: Db): Promise<ContratoEquipeRow[]> {
  return db.query<ContratoEquipeRow>(
    `SELECT c.*, lc.protocol, lc.title, lc.legal_area_id
     FROM contracts c JOIN legal_cases lc ON lc.id = c.case_id
     ORDER BY c.created_at DESC`,
  );
}

export async function buscarContrato(db: Db, contractId: string): Promise<ContratoRow | null> {
  const rows = await db.query<ContratoRow>("SELECT * FROM contracts WHERE id = $1", [contractId]);
  return rows[0] ?? null;
}

export async function criarContrato(
  db: Db,
  params: {
    caseId: string;
    feeType: FeeType;
    feeValueCents: number;
    successPercentage: number | null;
    createdBy: string;
    content: ContractContent;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, success_percentage, created_by, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      randomUUID(),
      params.caseId,
      params.feeType,
      params.feeValueCents,
      params.successPercentage,
      params.createdBy,
      JSON.stringify(params.content),
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

/** Só rascunho ou cancelado — nunca enviado nem assinado, preservando a evidência do acordo já
 * formalizado. A RLS (contracts_delete, migração 0017) já garante isso; aqui é defesa em
 * profundidade. Cascateia as parcelas (contract_installments) automaticamente. */
export async function excluirContrato(
  db: Db,
  contractId: string,
  statusAtual: ContractStatus,
): Promise<boolean> {
  if (statusAtual !== "draft" && statusAtual !== "cancelled") return false;
  const removed = await db.query("DELETE FROM contracts WHERE id = $1 RETURNING id", [contractId]);
  return removed.length > 0;
}

export type AssinaturaContrato = { signer_role: "lawyer" | "client"; signed_at: string };

/** Status de assinatura de cada parte (ContractDocument) — no máximo uma linha por papel, já que
 * um contrato só é assinado uma vez por cada lado (ver signatures_insert/signatures_insert_lawyer). */
export async function listarAssinaturasPorContrato(
  db: Db,
  contractId: string,
): Promise<AssinaturaContrato[]> {
  return db.query<AssinaturaContrato>(
    "SELECT signer_role, signed_at FROM contract_signatures WHERE contract_id = $1",
    [contractId],
  );
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

/**
 * Aceite eletrônico (PR5): move o contrato de 'sent' para 'signed' e grava a trilha de auditoria
 * na mesma transação — nunca uma sem a outra. A RLS (contracts_citizen_sign/signatures_insert,
 * migração 0012) garante que só o próprio cliente, e só a partir de 'sent', chega aqui; a
 * verificação de transição abaixo é defesa em profundidade, não a autorização em si.
 *
 * O hash cobre contrato + quem assinou + IP + o instante exato, para que a trilha prove o que foi
 * assinado e quando sem depender só do relógio do servidor no momento da leitura.
 */
/**
 * Assinatura do cliente (CONTRATANTE). `signerCpf` é o CPF redigitado no momento da assinatura —
 * nunca pré-preenchido pela tela — e já conferido pelo chamador contra o CPF do interessado no
 * caso antes de chegar aqui; essa função só grava o que foi conferido, não refaz a conferência.
 * Entrar na conta nunca é exigido para assinar (signedByHash cobre a sessão anônima), mas o CPF
 * substitui o clique único como segundo dado de prova de quem assinou.
 */
export async function assinarContrato(
  db: Db,
  params: {
    contractId: string;
    statusAtual: ContractStatus;
    signedBy: string | null;
    signedByHash: string | null;
    signerCpf: string;
    ip: string;
    userAgent: string;
  },
): Promise<void> {
  assertContractTransition(params.statusAtual, "signed");
  const assinadoEm = new Date().toISOString();
  const signatureHash = createHash("sha256")
    .update(
      [
        params.contractId,
        params.signedBy ?? params.signedByHash ?? "",
        params.signerCpf,
        params.ip,
        assinadoEm,
      ].join("|"),
    )
    .digest("hex");
  await db.transaction(async (tx) => {
    // A ordem importa: signatures_insert (migração 0012) só aceita a trilha enquanto o contrato
    // ainda está 'sent'. Gravando-a antes de mudar o status, a própria RLS garante que nunca
    // existe um contrato 'signed' sem uma assinatura correspondente.
    await tx.query(
      `INSERT INTO contract_signatures(id, contract_id, signer_role, signed_by, signed_by_hash, signer_cpf, signed_at, ip, user_agent, signature_hash)
       VALUES ($1, $2, 'client', $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        params.contractId,
        params.signedBy,
        params.signedByHash,
        params.signerCpf,
        assinadoEm,
        params.ip,
        params.userAgent,
        signatureHash,
      ],
    );
    await tx.query(
      "UPDATE contracts SET status = 'signed', signed_at = $2, signature_hash = $3, updated_at = now() WHERE id = $1",
      [params.contractId, assinadoEm, signatureHash],
    );
  });
}

/**
 * Assinatura do advogado (CONTRATADO), ao enviar o contrato ao cliente (draft -> sent) — antes
 * essa transição era uma troca de status direta, sem nenhum rastro de que o próprio advogado
 * responsável assinou. A prova aqui é a própria conta autenticada (login), por isso sem CPF
 * redigitado (diferente da assinatura do cliente, que pode nunca ter entrado numa conta).
 */
export async function assinarContratoAdvogado(
  db: Db,
  params: { contractId: string; statusAtual: ContractStatus; lawyerId: string; ip: string; userAgent: string },
): Promise<void> {
  assertContractTransition(params.statusAtual, "sent");
  const assinadoEm = new Date().toISOString();
  const signatureHash = createHash("sha256")
    .update(["lawyer", params.contractId, params.lawyerId, params.ip, assinadoEm].join("|"))
    .digest("hex");
  await db.transaction(async (tx) => {
    // Mesma ordem da assinatura do cliente: grava a trilha enquanto o contrato ainda está 'draft'
    // (signatures_insert_lawyer, migração 0024), só então muda o status para 'sent'.
    await tx.query(
      `INSERT INTO contract_signatures(id, contract_id, signer_role, signed_by, signed_at, ip, user_agent, signature_hash)
       VALUES ($1, $2, 'lawyer', $3, $4, $5, $6, $7)`,
      [randomUUID(), params.contractId, params.lawyerId, assinadoEm, params.ip, params.userAgent, signatureHash],
    );
    await tx.query("UPDATE contracts SET status = 'sent', updated_at = now() WHERE id = $1", [
      params.contractId,
    ]);
  });
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
