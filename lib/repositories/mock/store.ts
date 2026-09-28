import type { LegalCase } from "@/domain/case/schema";
import type { CaseDocument } from "@/domain/document/schema";
import type { DraftRecord } from "@/domain/draft";
import type { Dossier } from "@/domain/dossier/schema";
import type { TriageAnswer } from "@/domain/triage/schema";

/**
 * Armazenamento em memória do processo do servidor.
 * Fica em globalThis para sobreviver ao hot reload do `next dev`.
 * Os dados são perdidos ao reiniciar o servidor — comportamento esperado na fase F1.
 */
export interface MockStore {
  cases: Map<string, LegalCase>;
  answers: Map<string, TriageAnswer>;
  documents: Map<string, CaseDocument>;
  /** Versões do dossiê por caso, da mais antiga para a mais recente. */
  dossiers: Map<string, Dossier[]>;
  /** Rascunhos por "caseId|scope". */
  drafts: Map<string, DraftRecord>;
  /** Instante da última gravação oficial por "caseId|scope". */
  draftCommits: Map<string, string>;
}

const globalForStore = globalThis as unknown as { __jurisOfficeStore?: MockStore };

export function createStore(): MockStore {
  return {
    cases: new Map(),
    answers: new Map(),
    documents: new Map(),
    dossiers: new Map(),
    drafts: new Map(),
    draftCommits: new Map(),
  };
}

export function getGlobalStore(): MockStore {
  globalForStore.__jurisOfficeStore ??= createStore();
  return globalForStore.__jurisOfficeStore;
}

/**
 * Marca uma alteração de conteúdo no caso (revisão + data). Chamado de dentro dos
 * repositórios mock, no mesmo trecho síncrono da alteração.
 */
export function touchCase(store: MockStore, caseId: string, now: Date): void {
  const c = store.cases.get(caseId);
  if (c) store.cases.set(caseId, { ...c, revision: c.revision + 1, updatedAt: now.toISOString() });
}

/** Remove um atendimento e tudo o que pertence a ele (respostas, documentos, dossiês, rascunhos). */
export function removeCaseCascade(store: MockStore, caseId: string): void {
  store.cases.delete(caseId);
  for (const [k, a] of store.answers) if (a.caseId === caseId) store.answers.delete(k);
  for (const [k, d] of store.documents) if (d.caseId === caseId) store.documents.delete(k);
  store.dossiers.delete(caseId);
  for (const k of [...store.drafts.keys()]) if (k.startsWith(`${caseId}|`)) store.drafts.delete(k);
  for (const k of [...store.draftCommits.keys()]) {
    if (k.startsWith(`${caseId}|`)) store.draftCommits.delete(k);
  }
}

/**
 * Teto de atendimentos na memória: protege o servidor de testes exposto na internet contra
 * crescimento sem limite. Ao atingir o teto, descarta os menos recentemente atualizados.
 * Em produção (F5) isto não existe: o banco tem limites, retenção e exclusão próprios.
 */
export function enforceCaseCap(store: MockStore, maxCases: number): number {
  let removed = 0;
  while (store.cases.size >= maxCases) {
    let oldest: { id: string; at: string } | null = null;
    for (const c of store.cases.values()) {
      if (!oldest || c.updatedAt < oldest.at) oldest = { id: c.id, at: c.updatedAt };
    }
    if (!oldest) break;
    removeCaseCascade(store, oldest.id);
    removed++;
  }
  return removed;
}

export const DEFAULT_MAX_CASES = 2000;

export function maxCasesFromEnv(env: Record<string, string | undefined> = process.env): number {
  const n = Number.parseInt(env.MAX_ATENDIMENTOS_MEMORIA ?? "", 10);
  return Number.isInteger(n) && n >= 10 && n <= 100_000 ? n : DEFAULT_MAX_CASES;
}
