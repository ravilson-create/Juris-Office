import "server-only";
import type { Db } from "@/lib/db/types";
import { STATUS_PROFISSIONAL } from "@/domain/case/status";
import type { CaseStatus } from "@/domain/case/schema";

export type FiltroFila = {
  /** `undefined`/`null` = todos os status profissionais. */
  status?: CaseStatus | null;
  busca: string;
  /** Padrão: só não arquivados. `true` inverte — mostra só os arquivados. */
  arquivados?: boolean;
};

/** Mesma política de RLS de legal_cases decide o que o ator vê — aqui só filtra dentro disso. */
function statusFiltro(filtro: FiltroFila): CaseStatus[] {
  return filtro.status ? [filtro.status] : [...STATUS_PROFISSIONAL];
}

export async function contarCasosFila(db: Db, filtro: FiltroFila): Promise<number> {
  const rows = await db.query<{ count: string }>(
    `SELECT count(*) FROM legal_cases
     WHERE status = ANY($1) AND ($2 = '' OR protocol ILIKE '%' || $2 || '%' OR title ILIKE '%' || $2 || '%')
       AND (archived_at IS NOT NULL) = $3`,
    [statusFiltro(filtro), filtro.busca, Boolean(filtro.arquivados)],
  );
  return Number(rows[0]?.count ?? 0);
}

export type CasoFilaRow = {
  id: string;
  protocol: string;
  status: string;
  title: string | null;
  legal_area_id: string;
  updated_at: string;
};

export async function listarCasosFila(
  db: Db,
  filtro: FiltroFila,
  limit: number,
  offset: number,
): Promise<CasoFilaRow[]> {
  return db.query<CasoFilaRow>(
    `SELECT id, protocol, status, title, legal_area_id, updated_at FROM legal_cases
     WHERE status = ANY($1) AND ($2 = '' OR protocol ILIKE '%' || $2 || '%' OR title ILIKE '%' || $2 || '%')
       AND (archived_at IS NOT NULL) = $3
     ORDER BY updated_at DESC LIMIT $4 OFFSET $5`,
    [statusFiltro(filtro), filtro.busca, Boolean(filtro.arquivados), limit, offset],
  );
}
