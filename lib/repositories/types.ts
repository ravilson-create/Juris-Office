import type { LegalCase, CaseStatus, Applicant } from "@/domain/case/schema";
import type { LegalArea, LegalAreaSlug } from "@/domain/legal-area/schema";
import type { CaseDocument, DocumentChecklistItem } from "@/domain/document/schema";
import type { DraftRecord, DraftScope } from "@/domain/draft";
import type { Dossier } from "@/domain/dossier/schema";
import type { AnswerValue, TriageAnswer, TriageQuestion } from "@/domain/triage/schema";

/**
 * Contratos de persistência. A UI e os services dependem apenas destas interfaces;
 * a implementação (mock hoje, Supabase na fase F5) é escolhida em lib/repositories/index.ts.
 */
export interface LegalAreaRepository {
  list(): Promise<LegalArea[]>;
  findById(id: string): Promise<LegalArea | null>;
  findBySlug(slug: LegalAreaSlug): Promise<LegalArea | null>;
}

export interface CreateCaseInput {
  legalAreaId: string;
  protocol: string;
  ownerSessionHash?: string;
  citizenId?: string;
}

export interface UpdateCaseInput {
  status?: CaseStatus;
  applicant?: Applicant;
  consentAccepted?: boolean;
  consentAcceptedAt?: string;
  narrative?: string;
  title?: string;
  submittedAt?: string;
}

export interface FinalizeSubmissionInput {
  caseId: string;
  /** Revisão lida ao montar o dossiê; se mudou, nada é gravado. */
  expectedRevision: number;
  dossier: Dossier;
  submittedAt: string;
}

export type FinalizeSubmissionResult =
  | { ok: true; legalCase: LegalCase; dossier: Dossier }
  | { ok: false; reason: "not_found" | "already_submitted" | "revision_conflict" };

export interface CaseRepository {
  create(input: CreateCaseInput): Promise<LegalCase>;
  findById(id: string): Promise<LegalCase | null>;
  /** Casos criados pela sessão informada (hash), do mais recente para o mais antigo. */
  listByOwner(ownerSessionHash: string): Promise<LegalCase[]>;
  update(id: string, input: UpdateCaseInput): Promise<LegalCase>;
  /**
   * Operação atômica: grava o dossiê E marca o caso como finalizado, ou não grava nada.
   * Mock: trecho síncrono no processo único. Banco (F5): transação com bloqueio da linha do
   * caso, verificação da revisão e restrição UNIQUE (case_id, version) em `dossiers`.
   */
  finalizeSubmission(input: FinalizeSubmissionInput): Promise<FinalizeSubmissionResult>;
}

export interface SaveAnswerInput {
  caseId: string;
  question: Pick<TriageQuestion, "id" | "key">;
  value: AnswerValue;
}

export interface TriageRepository {
  listQuestions(legalAreaId: string): Promise<TriageQuestion[]>;
  listAnswers(caseId: string): Promise<TriageAnswer[]>;
  saveAnswer(input: SaveAnswerInput): Promise<TriageAnswer>;
  deleteAnswers(caseId: string, questionKeys: string[]): Promise<void>;
}

export interface AddDocumentInput {
  caseId: string;
  category: string;
  originalName: string;
  mimeType?: string;
  size: number;
}

export interface DocumentRepository {
  listChecklist(legalAreaId: string): Promise<DocumentChecklistItem[]>;
  listByCase(caseId: string): Promise<CaseDocument[]>;
  /**
   * Fase F1: registra apenas metadados (upload simulado). F5: grava no Storage.
   * Atômica: só insere se o caso tiver menos de `maxPerCase` documentos; senão retorna null.
   */
  add(input: AddDocumentInput, maxPerCase: number): Promise<CaseDocument | null>;
  remove(caseId: string, documentId: string): Promise<boolean>;
}

export interface DossierRepository {
  save(dossier: Dossier): Promise<Dossier>;
  /** Versão mais recente do dossiê do caso. */
  findLatest(caseId: string): Promise<Dossier | null>;
}

export interface DraftRepository {
  get(caseId: string, scope: DraftScope): Promise<DraftRecord | null>;
  /**
   * Atômica: grava só se `acceptsDraft` aprovar frente ao rascunho atual e à última
   * gravação oficial da parte. Retorna "stale" quando recusado.
   */
  save(draft: DraftRecord): Promise<"saved" | "stale">;
  /** Parte salva oficialmente: apaga o rascunho e registra o instante (barra rascunhos antigos). */
  markCommitted(caseId: string, scope: DraftScope, at: string): Promise<void>;
  deleteAllForCase(caseId: string): Promise<void>;
}

export interface Repositories {
  legalAreas: LegalAreaRepository;
  cases: CaseRepository;
  triage: TriageRepository;
  documents: DocumentRepository;
  dossiers: DossierRepository;
  drafts: DraftRepository;
}

/** Protocolo já existe (restrição UNIQUE); o serviço gera outro e tenta de novo. */
export class ProtocolConflictError extends Error {
  constructor(protocol: string) {
    super(`Protocolo já existente: ${protocol}`);
    this.name = "ProtocolConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} não encontrado: ${id}`);
    this.name = "NotFoundError";
  }
}
