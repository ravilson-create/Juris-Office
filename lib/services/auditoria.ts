import "server-only";
import type { Db } from "@/lib/db/types";

export type AuditoriaRow = {
  id: string;
  actor_id: string;
  case_id: string | null;
  action: string;
  occurred_at: string;
  protocol: string | null;
};

/**
 * Registra que `actor` acessou os dados de `caseId` — não as ações que já se auditam por si
 * (atribuir advogado, decidir viabilidade etc.), mas a simples leitura, que até aqui não deixava
 * rastro nenhum. Chamado uma vez por carregamento da página do caso na área profissional, nunca
 * no lado do cidadão (ver chamador): ver o próprio caso não é o que esta trilha audita.
 */
export async function registrarLeituraCaso(
  db: Db,
  params: { actor: string; caseId: string },
): Promise<void> {
  await db.query("INSERT INTO audit_logs(actor_id, case_id, action) VALUES ($1, $2, 'read_case')", [
    params.actor,
    params.caseId,
  ]);
}

/** A RLS (audit_read, migração 0013) já restringe ao que o ator pode ver. */
export async function listarAuditoria(
  db: Db,
  params: { caseId?: string; limit?: number } = {},
): Promise<AuditoriaRow[]> {
  const limit = params.limit ?? 200;
  if (params.caseId) {
    return db.query<AuditoriaRow>(
      `SELECT a.id, a.actor_id, a.case_id, a.action, a.occurred_at, c.protocol
       FROM audit_logs a LEFT JOIN legal_cases c ON c.id = a.case_id
       WHERE a.case_id = $1
       ORDER BY a.occurred_at DESC LIMIT $2`,
      [params.caseId, limit],
    );
  }
  return db.query<AuditoriaRow>(
    `SELECT a.id, a.actor_id, a.case_id, a.action, a.occurred_at, c.protocol
     FROM audit_logs a LEFT JOIN legal_cases c ON c.id = a.case_id
     ORDER BY a.occurred_at DESC LIMIT $1`,
    [limit],
  );
}
