import "server-only";
import type { Db } from "@/lib/db/types";
import { STATUS_PROFISSIONAL } from "@/domain/case/status";
import type { CaseStatus } from "@/domain/case/schema";

export type FiltroFila = {
  /** `undefined`/`null` = todos os status profissionais. */
  status?: CaseStatus | null;
  busca: string;
};

/** Mesma política de RLS de legal_cases decide o que o ator vê — aqui só filtra dentro disso. */
function statusFiltro(filtro: FiltroFila): CaseStatus[] {
  return filtro.status ? [filtro.status] : [...STATUS_PROFISSIONAL];
}

export async function contarCasosFila(db: Db, filtro: FiltroFila): Promise<number> {
  const rows = await db.query<{ count: string }>(
    `SELECT count(*) FROM legal_cases
     WHERE status = ANY($1) AND ($2 = '' OR protocol ILIKE '%' || $2 || '%' OR title ILIKE '%' || $2 || '%')`,
    [statusFiltro(filtro), filtro.busca],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listarCasosFila(
  db: Db,
  filtro: FiltroFila,
  limit: number,
  offset: number,
): Promise<{ id: string; protocol: string; status: string; title: string | null }[]> {
  return db.query<{ id: string; protocol: string; status: string; title: string | null }>(
    `SELECT id, protocol, status, title FROM legal_cases
     WHERE status = ANY($1) AND ($2 = '' OR protocol ILIKE '%' || $2 || '%' OR title ILIKE '%' || $2 || '%')
     ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
    [statusFiltro(filtro), filtro.busca, limit, offset],
  );
}
