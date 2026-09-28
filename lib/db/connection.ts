import "server-only";
import { PgDb } from "./pg-db";
import type { Db } from "./types";

const globalForDb = globalThis as unknown as { __jurisOfficeDb?: PgDb };

/** Conexão única do processo (sobrevive ao hot reload e é reaproveitada entre requisições). */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  globalForDb.__jurisOfficeDb ??= new PgDb(url);
  return globalForDb.__jurisOfficeDb;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
