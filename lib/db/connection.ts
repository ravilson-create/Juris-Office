import "server-only";
import { PgDb } from "./pg-db";
import type { Db } from "./types";

const globalForDb = globalThis as unknown as { __jurisOfficeDb?: PgDb };

/**
 * O app roda com um papel de banco restrito (só SELECT/INSERT/UPDATE/DELETE, sem DDL) quando
 * `APP_DATABASE_URL` está definida (ver docs/NEON-VERCEL.md). As migrações continuam usando
 * `DATABASE_URL`/`DATABASE_URL_UNPOOLED` (dono do esquema). Sem `APP_DATABASE_URL` (dev local,
 * CI, um único banco de teste), cai em `DATABASE_URL` — nada muda pra quem não configurou o
 * papel restrito.
 */
function runtimeDatabaseUrl(): string | undefined {
  return process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
}

/** Conexão única do processo (sobrevive ao hot reload e é reaproveitada entre requisições). */
export function getDb(): Db {
  const url = runtimeDatabaseUrl();
  if (!url) throw new Error("DATABASE_URL não configurada.");
  globalForDb.__jurisOfficeDb ??= new PgDb(url);
  return globalForDb.__jurisOfficeDb;
}

export function hasDatabase(): boolean {
  return Boolean(runtimeDatabaseUrl());
}
