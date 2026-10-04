import "server-only";
import type { Db } from "@/lib/db/types";

export const LIMITE_AUXILIOS_IA_MES = 50;

/** Quanto resta da cota mensal de auxílio da IA do advogado logado (migração 0025) — só leitura,
 * não consome a cota. Usado para mostrar "restam X de 50" nas telas de petição/peças. */
export async function buscarAuxiliosIARestantes(db: Db): Promise<number> {
  const [row] = await db.query<{ auxilios_ia_restantes: number }>(
    "SELECT auxilios_ia_restantes()",
  );
  return row?.auxilios_ia_restantes ?? LIMITE_AUXILIOS_IA_MES;
}
