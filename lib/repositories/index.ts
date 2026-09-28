import "server-only";
import { getDb, hasDatabase } from "@/lib/db/connection";
import { MockCaseRepository } from "./mock/case-repository";
import { MockDocumentRepository } from "./mock/document-repository";
import { MockDossierRepository } from "./mock/dossier-repository";
import { MockDraftRepository } from "./mock/draft-repository";
import { MockLegalAreaRepository } from "./mock/legal-area-repository";
import { getGlobalStore } from "./mock/store";
import { MockTriageRepository } from "./mock/triage-repository";
import { PgCaseRepository } from "./pg/case-repository";
import { PgDocumentRepository } from "./pg/document-repository";
import { PgDossierRepository } from "./pg/dossier-repository";
import { PgDraftRepository } from "./pg/draft-repository";
import { PgTriageRepository } from "./pg/triage-repository";
import type { Repositories } from "./types";

/**
 * Ponto único de escolha da implementação de persistência.
 * - Com `DATABASE_URL`: PostgreSQL (Neon). Catálogos (áreas, perguntas, checklists) ficam no código.
 * - Sem `DATABASE_URL`: memória do processo — só para desenvolvimento e testes. Em produção,
 *   exige `ALLOW_MEMORY_STORE=1` explícito, para nunca perder atendimentos sem perceber
 *   (ex.: em funções serverless, cada requisição pode cair em outra instância).
 */
export function getRepositories(): Repositories {
  if (hasDatabase()) {
    const db = getDb();
    return {
      legalAreas: new MockLegalAreaRepository(),
      cases: new PgCaseRepository(db),
      triage: new PgTriageRepository(db),
      documents: new PgDocumentRepository(db),
      dossiers: new PgDossierRepository(db),
      drafts: new PgDraftRepository(db),
    };
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "1") {
    throw new Error(
      "DATABASE_URL não configurada. Em produção o app não usa a memória do servidor por padrão.",
    );
  }
  const store = getGlobalStore();
  return {
    legalAreas: new MockLegalAreaRepository(),
    cases: new MockCaseRepository(store),
    triage: new MockTriageRepository(store),
    documents: new MockDocumentRepository(store),
    dossiers: new MockDossierRepository(store),
    drafts: new MockDraftRepository(store),
  };
}
