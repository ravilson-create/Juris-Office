import "server-only";
import { getDb, hasDatabase } from "@/lib/db/connection";
import type { Db } from "@/lib/db/types";

/**
 * Núcleo testável: conta acertos de `key` numa janela fixa de `windowSeconds`, guardado em
 * `rate_limit_hits`. Recebe o `Db` explicitamente (em vez de buscar um global) para poder ser
 * testado contra PGlite/PostgreSQL real sem depender de `DATABASE_URL`.
 */
export async function withinRateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await db.query<{ hits: number }>(
    `INSERT INTO rate_limit_hits (rate_key, window_start, hits)
     VALUES ($1, $2, 1)
     ON CONFLICT (rate_key, window_start) DO UPDATE SET hits = rate_limit_hits.hits + 1
     RETURNING hits`,
    [key, windowStart.toISOString()],
  );
  return (rows[0]?.hits ?? 0) <= limit;
}

/**
 * Usado pelas Server Actions. Sem banco configurado (memória, dev, testes unitários em
 * memória), nunca limita — não há como um processo de teste local abusar de si mesmo.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (!hasDatabase()) return true;
  return withinRateLimit(getDb(), key, limit, windowSeconds);
}
