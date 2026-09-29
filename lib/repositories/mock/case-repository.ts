import type { LegalCase } from "@/domain/case/schema";
import {
  NotFoundError,
  ProtocolConflictError,
  type CaseRepository,
  type CreateCaseInput,
  type FinalizeSubmissionInput,
  type FinalizeSubmissionResult,
  type UpdateCaseInput,
} from "../types";
import { enforceCaseCap, maxCasesFromEnv, type MockStore } from "./store";

export class MockCaseRepository implements CaseRepository {
  constructor(
    private readonly store: MockStore,
    private readonly now: () => Date = () => new Date(),
    private readonly maxCases: number = maxCasesFromEnv(),
  ) {}

  async create(input: CreateCaseInput): Promise<LegalCase> {
    for (const c of this.store.cases.values()) {
      if (c.protocol === input.protocol) throw new ProtocolConflictError(input.protocol);
    }
    enforceCaseCap(this.store, this.maxCases);
    const timestamp = this.now().toISOString();
    const legalCase: LegalCase = {
      id: crypto.randomUUID(),
      protocol: input.protocol,
      legalAreaId: input.legalAreaId,
      ownerSessionHash: input.ownerSessionHash,
      citizenId: input.citizenId,
      status: "draft",
      consentAccepted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
    };
    this.store.cases.set(legalCase.id, legalCase);
    return structuredClone(legalCase);
  }

  async findById(id: string): Promise<LegalCase | null> {
    const found = this.store.cases.get(id);
    return found ? structuredClone(found) : null;
  }

  async update(id: string, input: UpdateCaseInput): Promise<LegalCase> {
    const current = this.store.cases.get(id);
    if (!current) throw new NotFoundError("Caso", id);
    const updated: LegalCase = {
      ...current,
      ...input,
      revision: current.revision + 1,
      updatedAt: this.now().toISOString(),
    };
    this.store.cases.set(id, updated);
    return structuredClone(updated);
  }

  async listByOwner(ownerSessionHash: string): Promise<LegalCase[]> {
    return [...this.store.cases.values()]
      .filter((c) => c.ownerSessionHash === ownerSessionHash || c.citizenId === ownerSessionHash)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => structuredClone(c));
  }

  async finalizeSubmission(input: FinalizeSubmissionInput): Promise<FinalizeSubmissionResult> {
    // Sem `await` daqui até o fim: no processo único do Node, este trecho é indivisível.
    const current = this.store.cases.get(input.caseId);
    if (!current) return { ok: false, reason: "not_found" };
    if (current.submittedAt) return { ok: false, reason: "already_submitted" };
    if (current.revision !== input.expectedRevision) {
      return { ok: false, reason: "revision_conflict" };
    }
    const versions = this.store.dossiers.get(input.caseId) ?? [];
    if (versions.some((d) => d.version === input.dossier.version)) {
      return { ok: false, reason: "already_submitted" };
    }
    const updated: LegalCase = {
      ...current,
      status: "submitted",
      submittedAt: input.submittedAt,
      revision: current.revision + 1,
      updatedAt: input.submittedAt,
    };
    this.store.dossiers.set(input.caseId, [...versions, structuredClone(input.dossier)]);
    this.store.cases.set(input.caseId, updated);
    return {
      ok: true,
      legalCase: structuredClone(updated),
      dossier: structuredClone(input.dossier),
    };
  }
}
