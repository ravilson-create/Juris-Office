import "server-only";
import { Pool } from "pg";
import type { Queryable } from "./types";
const globalDb = globalThis as unknown as { jurisPrivatePool?: Pool };
// Exclusivo para autenticação, tokens de consulta e cobrança; nunca recebe SQL do navegador.
function pool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Banco não configurado.");
  if (!globalDb.jurisPrivatePool) {
    globalDb.jurisPrivatePool = new Pool({
      connectionString: url,
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    });
    globalDb.jurisPrivatePool.on("error", () => undefined);
  }
  return globalDb.jurisPrivatePool;
}
export async function privateQuery<T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await pool().query(sql, values)).rows as T[];
}
export async function privateTransaction<T>(fn: (tx: Queryable) => Promise<T>) {
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const result = await fn({
      query: async <R>(sql: string, values?: unknown[]) => (await c.query(sql, values)).rows as R[],
    });
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
