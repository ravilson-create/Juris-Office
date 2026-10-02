import "server-only";
import type { Db } from "@/lib/db/types";
import { STATUS_PROFISSIONAL } from "@/domain/case/status";

/**
 * Painel inicial da área profissional (PR 1 do Portal do Advogado). As duas consultas não
 * filtram por advogado/escritório no SQL — a política de RLS já restringe `legal_cases` ao que
 * o ator autenticado pode ver (advogado: só caso atribuído a ele; admin: só do escritório),
 * então o resultado já vem correto para quem está logado.
 */
export async function contarCasosPorStatus(
  db: Db,
): Promise<{ status: string; count: string }[]> {
  return db.query<{ status: string; count: string }>(
    "SELECT status, count(*) FROM legal_cases WHERE status = ANY($1) AND archived_at IS NULL GROUP BY status",
    [STATUS_PROFISSIONAL],
  );
}

/**
 * Casos do escritório ainda sem advogado atribuído. Só faz sentido para administrador: para o
 * advogado, todo caso que ele vê já está atribuído a ele mesmo (é o que a RLS permite enxergar),
 * então a contagem dele seria sempre zero — por isso a tela só mostra isto ao admin.
 */
export async function contarCasosSemAdvogado(db: Db): Promise<number> {
  const rows = await db.query<{ count: string }>(
    `SELECT count(*) FROM legal_cases c
     WHERE c.status = ANY($1) AND c.archived_at IS NULL AND NOT EXISTS (
       SELECT 1 FROM case_assignments a WHERE a.case_id = c.id
     )`,
    [STATUS_PROFISSIONAL],
  );
  return Number(rows[0]?.count ?? 0);
}
