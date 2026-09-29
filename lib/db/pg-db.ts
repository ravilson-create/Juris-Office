import { Pool } from "pg";
import type { Db, Queryable } from "./types";
import { authEnabled, currentUserId } from "@/lib/auth/session";

/**
 * Cliente PostgreSQL (Neon) sobre `pg`. Em funções serverless, use a URL *pooled* do Neon
 * (host com "-pooler"): o pool local é pequeno e o Neon multiplexa as conexões.
 */
export class PgDb implements Db {
  private readonly pool: Pool;

  constructor(connectionString: string, maxConnections = 3) {
    this.pool = new Pool({
      connectionString,
      max: maxConnections,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    // Erro em conexão ociosa não pode derrubar o processo.
    this.pool.on("error", () => undefined);
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    if (authEnabled) {
      return this.transaction((tx) => tx.query<T>(text, params));
    }
    const result = await this.pool.query(text, params as unknown[]);
    return result.rows as T[];
  }

  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (authEnabled) {
        const userId = await currentUserId();
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId ?? ""]);
      }
      const tx: Queryable = {
        query: async <R = Record<string, unknown>>(text: string, params?: unknown[]) =>
          (await client.query(text, params as unknown[])).rows as R[],
      };
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
