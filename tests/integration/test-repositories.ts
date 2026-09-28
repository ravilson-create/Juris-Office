import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PgDb } from "@/lib/db/pg-db";
import type { Db, Queryable } from "@/lib/db/types";
import { MockCaseRepository } from "@/lib/repositories/mock/case-repository";
import { MockDocumentRepository } from "@/lib/repositories/mock/document-repository";
import { MockDossierRepository } from "@/lib/repositories/mock/dossier-repository";
import { MockDraftRepository } from "@/lib/repositories/mock/draft-repository";
import { MockLegalAreaRepository } from "@/lib/repositories/mock/legal-area-repository";
import { createStore } from "@/lib/repositories/mock/store";
import { MockTriageRepository } from "@/lib/repositories/mock/triage-repository";
import { PgCaseRepository } from "@/lib/repositories/pg/case-repository";
import { PgDocumentRepository } from "@/lib/repositories/pg/document-repository";
import { PgDossierRepository } from "@/lib/repositories/pg/dossier-repository";
import { PgDraftRepository } from "@/lib/repositories/pg/draft-repository";
import { PgTriageRepository } from "@/lib/repositories/pg/triage-repository";
import type { Repositories } from "@/lib/repositories/types";

/**
 * Onde as suítes de integração rodam:
 * - "memoria" (padrão): repositórios em memória;
 * - "pg": PostgreSQL em WebAssembly (PGlite), sem servidor — transações serializadas;
 * - "pgreal": PostgreSQL de verdade em TEST_DATABASE_URL, com conexões paralelas
 *   (é aqui que o bloqueio de linha e as restrições são exercitados de fato).
 */
export const BACKEND: "memoria" | "pg" | "pgreal" =
  process.env.TEST_BACKEND === "pgreal"
    ? "pgreal"
    : process.env.TEST_BACKEND === "pg"
      ? "pg"
      : "memoria";

const TRUNCATE =
  "TRUNCATE legal_cases, triage_answers, case_documents, dossiers, case_drafts, case_draft_commits CASCADE";

/** Db sobre PostgreSQL real; cada instância zera as tabelas antes do primeiro uso. */
export class RealPgDb implements Db {
  private static shared: PgDb | undefined;
  private readonly ready: Promise<PgDb>;

  constructor() {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error("TEST_DATABASE_URL não definida.");
    RealPgDb.shared ??= new PgDb(url, 12);
    const db = RealPgDb.shared;
    this.ready = db.query(TRUNCATE).then(() => db);
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    return (await this.ready).query<T>(text, params);
  }

  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    return (await this.ready).transaction(fn);
  }
}

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

// Uma instância do PostgreSQL por processo de teste; cada teste começa com as tabelas vazias.
let shared: Promise<PGlite> | undefined;
function sharedPglite(): Promise<PGlite> {
  shared ??= (async () => {
    const db = new PGlite();
    for (const file of readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    }
    return db;
  })();
  return shared;
}

/** Db sobre PGlite. Transações do PGlite são serializadas (uma de cada vez). */
export class PgliteDb implements Db {
  private readonly ready: Promise<PGlite>;

  constructor() {
    this.ready = sharedPglite().then(async (db) => {
      await db.exec(TRUNCATE);
      return db;
    });
  }

  async query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
    const db = await this.ready;
    return (await db.query(text, params)).rows as T[];
  }

  async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
    const db = await this.ready;
    return db.transaction((tx) =>
      fn({
        query: async <R = Record<string, unknown>>(text: string, params?: unknown[]) =>
          (await tx.query(text, params)).rows as R[],
      }),
    );
  }
}

/** Repositórios isolados por teste (sem estado global). */
export function createTestRepositories(): Repositories {
  if (BACKEND === "pg" || BACKEND === "pgreal") {
    const db: Db = BACKEND === "pgreal" ? new RealPgDb() : new PgliteDb();
    return {
      legalAreas: new MockLegalAreaRepository(),
      cases: new PgCaseRepository(db),
      triage: new PgTriageRepository(db),
      documents: new PgDocumentRepository(db),
      dossiers: new PgDossierRepository(db),
      drafts: new PgDraftRepository(db),
    };
  }
  const store = createStore();
  return {
    legalAreas: new MockLegalAreaRepository(),
    cases: new MockCaseRepository(store),
    triage: new MockTriageRepository(store),
    documents: new MockDocumentRepository(store),
    dossiers: new MockDossierRepository(store),
    drafts: new MockDraftRepository(store),
  };
}
