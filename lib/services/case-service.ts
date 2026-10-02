import { narrativeSchema } from "@/domain/case/narrative";
import {
  draftMetaSchema,
  draftScopeSchema,
  draftValuesSchema,
  triageDraftScope,
  type DraftRecord,
  type DraftScope,
} from "@/domain/draft";
import { applicantSchema, type CaseStatus, type LegalCase } from "@/domain/case/schema";
import { generateProtocol } from "@/domain/case/protocol";
import { assertTransition, isDeletable, isEditableByCitizen } from "@/domain/case/status";
import { legalAreaSlugSchema, type LegalArea } from "@/domain/legal-area/schema";
import {
  OTHER_DOCUMENTS_CATEGORY,
  OTHER_DOCUMENTS_LABEL,
  type CaseDocument,
  type DocumentChecklistItem,
} from "@/domain/document/schema";
import { buildDossier } from "@/domain/dossier/builder";
import type { Dossier } from "@/domain/dossier/schema";
import { checkDocument, documentMetaSchema, MAX_DOCUMENTS_PER_CASE } from "@/domain/document/rules";
import {
  buildSteps,
  completion,
  firstIncompleteStep,
  reconcileAnswers,
  validateStep,
  type AnswerMap,
  type TriageStep,
} from "@/domain/triage/engine";
import type { RawFormValues, TriageQuestion } from "@/domain/triage/schema";
import { ProtocolConflictError, type Repositories } from "@/lib/repositories/types";
import { getProcessCaseLock, type CaseLock } from "./case-lock";
import { DomainError, type ServiceResult } from "./errors";

export interface CaseOverview {
  legalCase: LegalCase;
  area: LegalArea;
}

export interface TriageContext extends CaseOverview {
  questions: TriageQuestion[];
  steps: TriageStep[];
  /** Respostas gravadas (para preencher o formulário, inclusive as que precisam de ajuste). */
  answers: AnswerMap;
  /** Somente respostas visíveis e válidas — base da revisão, do dossiê e do envio. */
  validAnswers: AnswerMap;
  /** Respostas gravadas que não passam mais nas regras, com a mensagem de ajuste. */
  invalid: Record<string, string>;
  completion: number;
}

export interface DocumentsContext extends CaseOverview {
  checklist: DocumentChecklistItem[];
  documents: CaseDocument[];
}

export interface ReviewContext extends TriageContext {
  checklist: DocumentChecklistItem[];
  documents: CaseDocument[];
  /** Itens recomendados do checklist sem nenhum arquivo enviado. */
  missingRecommended: DocumentChecklistItem[];
}

function fieldErrorsFrom(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export interface MyCaseItem {
  id: string;
  protocol: string;
  archived: boolean;
  areaName: string;
  status: CaseStatus;
  updatedAt: string;
  finalized: boolean;
  /** Onde continuar: primeira etapa pendente, ou o protocolo se já finalizado. */
  continueHref: string;
  continueLabel: string;
}

export interface SubmissionContext extends CaseOverview {
  dossier: Dossier;
}

export class CaseService {
  constructor(
    private readonly repos: Repositories,
    private readonly now: () => Date = () => new Date(),
    private readonly lock: CaseLock = getProcessCaseLock(),
  ) {}

  listLegalAreas() {
    return this.repos.legalAreas.list();
  }

  async createCase(
    areaSlug: string,
    ownerSessionHash?: string,
    citizenId?: string,
  ): Promise<LegalCase> {
    const slug = legalAreaSlugSchema.safeParse(areaSlug);
    const area = slug.success ? await this.repos.legalAreas.findBySlug(slug.data) : null;
    if (!area || !area.active) {
      throw new DomainError("Área jurídica indisponível.", "area_unavailable");
    }
    // O protocolo é único (restrição no banco): em colisão, gera outro e tenta de novo.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.repos.cases.create({
          legalAreaId: area.id,
          protocol: generateProtocol(this.now()),
          ownerSessionHash,
          citizenId,
        });
      } catch (error) {
        if (!(error instanceof ProtocolConflictError) || attempt >= 5) throw error;
      }
    }
  }

  async getOverview(caseId: string): Promise<CaseOverview | null> {
    const legalCase = await this.repos.cases.findById(caseId);
    if (!legalCase) return null;
    const area = await this.repos.legalAreas.findById(legalCase.legalAreaId);
    if (!area) return null;
    return { legalCase, area };
  }

  private async requireEditable(caseId: string): Promise<LegalCase> {
    const legalCase = await this.repos.cases.findById(caseId);
    if (!legalCase) throw new DomainError("Atendimento não encontrado.", "not_found");
    if (!isEditableByCitizen(legalCase.status)) {
      throw new DomainError("Este atendimento não pode mais ser alterado.", "not_editable");
    }
    return legalCase;
  }

  private async saveApplicantUnlocked(
    caseId: string,
    input: unknown,
  ): Promise<ServiceResult<LegalCase>> {
    const legalCase = await this.requireEditable(caseId);
    const parsed = applicantSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: "Revise os campos destacados.",
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      };
    }
    const nextStatus = legalCase.status === "draft" ? "triage" : legalCase.status;
    assertTransition(legalCase.status, nextStatus);
    const updated = await this.repos.cases.update(caseId, {
      applicant: parsed.data,
      consentAccepted: true,
      consentAcceptedAt: legalCase.consentAcceptedAt ?? this.now().toISOString(),
      status: nextStatus,
    });
    await this.repos.drafts.markCommitted(caseId, "identificacao", this.now().toISOString());
    return { ok: true, data: updated };
  }

  async getTriageContext(caseId: string): Promise<TriageContext | null> {
    const overview = await this.getOverview(caseId);
    if (!overview) return null;
    const questions = await this.repos.triage.listQuestions(overview.area.id);
    const answers = await this.loadAnswerMap(caseId);
    const now = this.now();
    const r = reconcileAnswers(questions, answers, now);
    return {
      ...overview,
      questions,
      steps: buildSteps(questions),
      answers,
      validAnswers: r.answers,
      invalid: r.invalid,
      completion: completion(questions, answers, now),
    };
  }

  private async loadAnswerMap(caseId: string): Promise<AnswerMap> {
    const list = await this.repos.triage.listAnswers(caseId);
    return Object.fromEntries(list.map((a) => [a.questionKey, a.value]));
  }

  /**
   * Valida e salva uma etapa da triagem.
   * Respostas de perguntas ocultas ou apagadas pelo usuário são removidas.
   */
  private async saveTriageStepUnlocked(
    caseId: string,
    stepIndex: number,
    raw: RawFormValues,
  ): Promise<ServiceResult<{ nextStep: number | null }>> {
    const legalCase = await this.requireEditable(caseId);
    if (legalCase.status === "draft" || !legalCase.applicant) {
      throw new DomainError("Preencha a identificação antes da triagem.", "identification_pending");
    }
    const questions = await this.repos.triage.listQuestions(legalCase.legalAreaId);
    const steps = buildSteps(questions);
    const step = steps[stepIndex];
    if (!step) throw new DomainError("Etapa inexistente.", "step_out_of_range");

    const saved = await this.loadAnswerMap(caseId);
    const stepKeys = new Set(step.questions.map((q) => q.key));
    const previous = Object.fromEntries(Object.entries(saved).filter(([k]) => !stepKeys.has(k)));

    const result = validateStep(step.questions, raw, previous, this.now());
    if (!result.valid) {
      return {
        ok: false,
        message: "Algumas respostas precisam de ajuste.",
        fieldErrors: result.errors,
      };
    }

    for (const q of step.questions) {
      const value = result.values[q.key];
      if (value !== undefined) await this.repos.triage.saveAnswer({ caseId, question: q, value });
    }
    const toRemove = new Set(
      step.questions.map((q) => q.key).filter((k) => result.values[k] === undefined),
    );
    // Reavalia o caso inteiro: respostas de outras etapas que ficaram ocultas por esta
    // alteração são apagadas, para não voltarem como confirmadas se a condição se repetir.
    const merged = { ...previous, ...result.values };
    for (const key of reconcileAnswers(questions, merged, this.now()).hidden) toRemove.add(key);
    await this.repos.triage.deleteAnswers(caseId, [...toRemove]);

    const nextStep = stepIndex + 1 < steps.length ? stepIndex + 1 : null;
    await this.repos.drafts.markCommitted(
      caseId,
      triageDraftScope(stepIndex),
      this.now().toISOString(),
    );
    return { ok: true, data: { nextStep } };
  }

  // ---------------------------------------------------------------- Relato (Sprint 2)

  /** Triagem concluída = todas as etapas com obrigatórias respondidas. */
  async isTriageComplete(legalCase: LegalCase): Promise<boolean> {
    const questions = await this.repos.triage.listQuestions(legalCase.legalAreaId);
    const steps = buildSteps(questions);
    const answers = await this.loadAnswerMap(legalCase.id);
    return firstIncompleteStep(steps, answers, this.now()) === steps.length;
  }

  private async moveTo(legalCase: LegalCase, to: CaseStatus): Promise<void> {
    if (legalCase.status === to) return;
    assertTransition(legalCase.status, to);
    await this.repos.cases.update(legalCase.id, { status: to });
  }

  private async saveNarrativeUnlocked(
    caseId: string,
    input: unknown,
  ): Promise<ServiceResult<LegalCase>> {
    const legalCase = await this.requireEditable(caseId);
    if (!legalCase.applicant) {
      throw new DomainError("Preencha a identificação antes do relato.", "identification_pending");
    }
    if (!(await this.isTriageComplete(legalCase))) {
      throw new DomainError("Conclua a triagem antes do relato.", "triage_pending");
    }
    const parsed = narrativeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: "Revise o relato.",
        fieldErrors: fieldErrorsFrom(parsed.error.issues),
      };
    }
    // Primeira gravação avança para documentos; edições posteriores mantêm o status.
    const status = legalCase.status === "triage" ? "awaiting_documents" : legalCase.status;
    assertTransition(legalCase.status, status);
    const updated = await this.repos.cases.update(caseId, {
      narrative: parsed.data.narrative,
      status,
    });
    await this.repos.drafts.markCommitted(caseId, "relato", this.now().toISOString());
    return { ok: true, data: updated };
  }

  // ---------------------------------------------------------- Documentos (Sprint 2)

  private async requireNarrative(caseId: string): Promise<LegalCase> {
    const legalCase = await this.requireEditable(caseId);
    if (!legalCase.narrative) {
      throw new DomainError("Registre o relato antes de enviar documentos.", "narrative_pending");
    }
    return legalCase;
  }

  async getDocumentsContext(caseId: string): Promise<DocumentsContext | null> {
    const overview = await this.getOverview(caseId);
    if (!overview) return null;
    const [checklist, documents] = await Promise.all([
      this.repos.documents.listChecklist(overview.area.id),
      this.repos.documents.listByCase(caseId),
    ]);
    return { ...overview, checklist, documents };
  }

  private async addDocumentUnlocked(
    caseId: string,
    input: unknown,
  ): Promise<ServiceResult<CaseDocument>> {
    const legalCase = await this.requireNarrative(caseId);
    const meta = documentMetaSchema.safeParse(input);
    if (!meta.success) return { ok: false, message: "Dados do arquivo inválidos." };

    const checklist = await this.repos.documents.listChecklist(legalCase.legalAreaId);
    const validCategory =
      meta.data.category === OTHER_DOCUMENTS_CATEGORY ||
      checklist.some((i) => i.category === meta.data.category);
    if (!validCategory) return { ok: false, message: "Categoria de documento inválida." };

    const check = checkDocument(meta.data);
    if (!check.ok) return { ok: false, message: check.error };

    const doc = await this.repos.documents.add(
      {
        caseId,
        category: meta.data.category,
        originalName: check.name,
        mimeType: meta.data.mimeType || undefined,
        size: meta.data.size,
      },
      MAX_DOCUMENTS_PER_CASE,
    );
    if (!doc) {
      throw new DomainError(
        `Limite de ${MAX_DOCUMENTS_PER_CASE} arquivos por atendimento atingido. Remova algum para registrar outro.`,
        "document_limit",
      );
    }
    return { ok: true, data: doc };
  }

  private async removeDocumentUnlocked(
    caseId: string,
    documentId: string,
  ): Promise<ServiceResult<null>> {
    await this.requireNarrative(caseId);
    const removed = await this.repos.documents.remove(caseId, documentId);
    return removed ? { ok: true, data: null } : { ok: false, message: "Documento não encontrado." };
  }

  /** Encerra a etapa de documentos (todos são opcionais) e libera a revisão. */
  private async finishDocumentsUnlocked(caseId: string): Promise<LegalCase> {
    const legalCase = await this.requireNarrative(caseId);
    if (legalCase.status === "awaiting_documents") await this.moveTo(legalCase, "ready_for_review");
    return (await this.repos.cases.findById(caseId))!;
  }

  // ------------------------------------------------------------- Revisão (Sprint 2)

  async getReviewContext(caseId: string): Promise<ReviewContext | null> {
    const triage = await this.getTriageContext(caseId);
    if (!triage) return null;
    const [checklist, documents] = await Promise.all([
      this.repos.documents.listChecklist(triage.area.id),
      this.repos.documents.listByCase(caseId),
    ]);
    const sent = new Set(documents.map((d) => d.category));
    return {
      ...triage,
      checklist,
      documents,
      missingRecommended: checklist.filter((i) => i.recommended && !sent.has(i.category)),
    };
  }

  // ------------------------------------------------------ Dossiê e envio (Sprint 3)

  /**
   * Finaliza o atendimento: gera o dossiê e marca o caso como finalizado, numa gravação
   * atômica. Idempotente: se o caso já foi finalizado, devolve a finalização existente
   * (mesmo dossiê), em vez de gerar outro. Chamadas simultâneas entram na fila do caso.
   */
  async submitCase(caseId: string): Promise<SubmissionContext> {
    return this.lock.run(caseId, () => this.submitCaseUnlocked(caseId));
  }

  private async submitCaseUnlocked(caseId: string): Promise<SubmissionContext> {
    const existing = await this.getSubmission(caseId);
    if (existing) return existing;

    const legalCase = await this.requireEditable(caseId);
    if (legalCase.status !== "ready_for_review") {
      throw new DomainError("Revise o atendimento antes de finalizar.", "review_pending");
    }
    const ctx = await this.getReviewContext(caseId);
    if (!ctx || !legalCase.applicant) {
      throw new DomainError(
        "Preencha a identificação antes de finalizar.",
        "identification_pending",
      );
    }
    if (firstIncompleteStep(ctx.steps, ctx.answers, this.now()) < ctx.steps.length) {
      throw new DomainError("Conclua a triagem antes de finalizar.", "triage_pending");
    }
    if (!legalCase.narrative) {
      throw new DomainError("Registre o relato antes de finalizar.", "narrative_pending");
    }

    const previous = await this.repos.dossiers.findLatest(caseId);
    const now = this.now();
    const dossier = buildDossier({
      id: crypto.randomUUID(),
      version: (previous?.version ?? 0) + 1,
      legalCase: { ...legalCase, applicant: legalCase.applicant, narrative: legalCase.narrative },
      area: ctx.area,
      questions: ctx.questions,
      answers: ctx.validAnswers,
      documents: ctx.documents,
      checklist: ctx.checklist,
      otherDocumentsLabel: OTHER_DOCUMENTS_LABEL,
      now,
    });
    assertTransition(legalCase.status, "submitted");
    const result = await this.repos.cases.finalizeSubmission({
      caseId,
      expectedRevision: legalCase.revision,
      dossier,
      submittedAt: now.toISOString(),
    });
    if (result.ok) {
      // Minimização: rascunhos deixam de ter uso depois da finalização.
      await this.repos.drafts.deleteAllForCase(caseId);
      return { legalCase: result.legalCase, area: ctx.area, dossier: result.dossier };
    }
    if (result.reason === "already_submitted") {
      const done = await this.getSubmission(caseId);
      if (done) return done;
    }
    if (result.reason === "revision_conflict") {
      throw new DomainError(
        "O atendimento foi alterado durante a finalização. Revise as informações e finalize de novo.",
        "revision_conflict",
      );
    }
    throw new DomainError("Não foi possível finalizar o atendimento.", "not_found");
  }

  /** Caso enviado + dossiê mais recente; null se ainda não houve envio. */
  async getSubmission(caseId: string): Promise<SubmissionContext | null> {
    const overview = await this.getOverview(caseId);
    if (!overview || !overview.legalCase.submittedAt) return null;
    const dossier = await this.repos.dossiers.findLatest(caseId);
    return dossier ? { ...overview, dossier } : null;
  }

  // ------------------------------------------- Operações que alteram o caso (com trava)

  saveApplicant(caseId: string, input: unknown) {
    return this.lock.run(caseId, () => this.saveApplicantUnlocked(caseId, input));
  }

  saveTriageStep(caseId: string, stepIndex: number, raw: RawFormValues) {
    return this.lock.run(caseId, () => this.saveTriageStepUnlocked(caseId, stepIndex, raw));
  }

  saveNarrative(caseId: string, input: unknown) {
    return this.lock.run(caseId, () => this.saveNarrativeUnlocked(caseId, input));
  }

  addDocument(caseId: string, input: unknown) {
    return this.lock.run(caseId, () => this.addDocumentUnlocked(caseId, input));
  }

  removeDocument(caseId: string, documentId: string) {
    return this.lock.run(caseId, () => this.removeDocumentUnlocked(caseId, documentId));
  }

  finishDocuments(caseId: string) {
    return this.lock.run(caseId, () => this.finishDocumentsUnlocked(caseId));
  }

  /** Exclui o atendimento — só antes de aceito/em andamento (isDeletable); a RLS aplica a mesma
   * regra do lado do banco (migração 0017), isto é defesa em profundidade. */
  deleteCase(caseId: string) {
    return this.lock.run(caseId, () => this.deleteCaseUnlocked(caseId));
  }

  private async deleteCaseUnlocked(caseId: string): Promise<ServiceResult<null>> {
    const legalCase = await this.repos.cases.findById(caseId);
    if (!legalCase) return { ok: false, message: "Atendimento não encontrado." };
    if (!isDeletable(legalCase.status)) {
      return {
        ok: false,
        message: "Este atendimento já foi aceito ou está em andamento e não pode mais ser excluído.",
      };
    }
    const removed = await this.repos.cases.delete(caseId);
    return removed ? { ok: true, data: null } : { ok: false, message: "Atendimento não encontrado." };
  }

  // ------------------------------------------------------ Rascunhos (Sprint 4.1)

  async getDraft(caseId: string, scope: DraftScope): Promise<DraftRecord | null> {
    return this.repos.drafts.get(caseId, scope);
  }

  /**
   * Grava um rascunho sem validar preenchimento. Recusa (sem erro) rascunhos desatualizados;
   * lança `not_editable` se o atendimento já foi finalizado.
   */
  saveDraft(
    caseId: string,
    scope: unknown,
    values: unknown,
    meta: unknown,
  ): Promise<ServiceResult<{ status: "saved" | "stale"; savedAt: string }>> {
    return this.lock.run(caseId, async () => {
      await this.requireEditable(caseId);
      const s = draftScopeSchema.safeParse(scope);
      const v = draftValuesSchema.safeParse(values);
      const m = draftMetaSchema.safeParse(meta);
      if (!s.success || !v.success || !m.success) {
        return { ok: false, message: "Rascunho em formato inválido." };
      }
      const savedAt = this.now().toISOString();
      const status = await this.repos.drafts.save({
        caseId,
        scope: s.data,
        values: v.data,
        ...m.data,
        savedAt,
      });
      return { ok: true, data: { status, savedAt } };
    });
  }

  // ------------------------------------------------ Meus atendimentos (Sprint 4.1)

  /**
   * Atendimentos criados pela sessão informada. O filtro acontece aqui, no servidor:
   * a página nunca recebe casos de outras sessões.
   */
  async listMyCases(ownerSessionHash: string): Promise<MyCaseItem[]> {
    const cases = await this.repos.cases.listByOwner(ownerSessionHash);
    const areas = new Map((await this.repos.legalAreas.list()).map((a) => [a.id, a.name]));
    const items: MyCaseItem[] = [];
    for (const c of cases) {
      const base = `/atendimento/${c.id}`;
      let continueHref = `${base}/protocolo`;
      let continueLabel = "Ver protocolo e dossiê";
      const finalized = !isEditableByCitizen(c.status);
      if (!finalized) {
        continueLabel = "Continuar de onde parou";
        if (!c.applicant) continueHref = `${base}/identificacao`;
        else {
          const questions = await this.repos.triage.listQuestions(c.legalAreaId);
          const steps = buildSteps(questions);
          const pending = firstIncompleteStep(steps, await this.loadAnswerMap(c.id), this.now());
          if (pending < steps.length) continueHref = `${base}/triagem?etapa=${pending + 1}`;
          else if (!c.narrative) continueHref = `${base}/relato`;
          else if (c.status === "awaiting_documents" || c.status === "triage")
            continueHref = `${base}/documentos`;
          else continueHref = `${base}/revisar`;
        }
      }
      items.push({
        id: c.id,
        protocol: c.protocol,
        archived: Boolean(c.archivedAt),
        areaName: areas.get(c.legalAreaId) ?? "Área",
        status: c.status,
        updatedAt: c.updatedAt,
        finalized,
        continueHref,
        continueLabel,
      });
    }
    return items;
  }

  /** Arquiva em qualquer status — oculta das listas padrão, mas não apaga nada. Reversível. */
  async archiveCase(caseId: string): Promise<ServiceResult<null>> {
    const legalCase = await this.repos.cases.findById(caseId);
    if (!legalCase) return { ok: false, message: "Atendimento não encontrado." };
    await this.repos.cases.update(caseId, { archivedAt: new Date().toISOString() });
    return { ok: true, data: null };
  }

  async unarchiveCase(caseId: string): Promise<ServiceResult<null>> {
    const legalCase = await this.repos.cases.findById(caseId);
    if (!legalCase) return { ok: false, message: "Atendimento não encontrado." };
    await this.repos.cases.update(caseId, { archivedAt: null });
    return { ok: true, data: null };
  }
}
