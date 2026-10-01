import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db/types";
import type { DeadlineCountingRule } from "@/domain/deadline/schema";

export type PrazoRow = {
  id: string;
  case_id: string;
  due_date: string;
  type: string;
  counting_rule: DeadlineCountingRule;
  status: "open" | "done" | "missed";
  assigned_to: string;
  escalated_at: string | null;
  created_at: string;
};

export async function criarPrazo(
  db: Db,
  params: {
    caseId: string;
    dueDate: string;
    type: string;
    countingRule: DeadlineCountingRule;
    assignedTo: string;
    createdBy: string;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO deadlines(id, case_id, due_date, type, counting_rule, assigned_to, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      randomUUID(),
      params.caseId,
      params.dueDate,
      params.type,
      params.countingRule,
      params.assignedTo,
      params.createdBy,
    ],
  );
}

/** A política de RLS (deadlines_update) garante que só o responsável ou um admin conclui. */
export async function concluirPrazo(db: Db, deadlineId: string): Promise<void> {
  await db.query(
    "UPDATE deadlines SET status = 'done', done_at = now() WHERE id = $1 AND status != 'done'",
    [deadlineId],
  );
}

export async function listarPrazosPorCaso(db: Db, caseId: string): Promise<PrazoRow[]> {
  return db.query<PrazoRow>(
    "SELECT * FROM deadlines WHERE case_id = $1 ORDER BY due_date ASC",
    [caseId],
  );
}

/** Prazos abertos vencendo nos próximos `dias` — a RLS já restringe ao que o ator pode ver. */
export async function listarPrazosProximos(db: Db, dias: number): Promise<PrazoRow[]> {
  return db.query<PrazoRow>(
    `SELECT * FROM deadlines WHERE status = 'open' AND due_date <= current_date + $1::int
     ORDER BY due_date ASC`,
    [dias],
  );
}

export async function contarPrazosVencidos(db: Db): Promise<number> {
  const rows = await db.query<{ count: string }>(
    "SELECT count(*) FROM deadlines WHERE status = 'missed'",
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Job de manutenção (cron): marca como 'missed' todo prazo aberto cuja data já passou, e
 * registra o momento da escalada. Roda na conexão de manutenção (dona das tabelas, fora da
 * RLS) porque precisa alcançar prazos de todos os escritórios de uma vez, não só os de um ator.
 */
export async function escalonarPrazosVencidos(db: Db): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `UPDATE deadlines SET status = 'missed', escalated_at = now()
     WHERE status = 'open' AND due_date < current_date
     RETURNING id`,
  );
  return rows.length;
}
