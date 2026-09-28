import type { CaseDocument, DocumentChecklistItem } from "@/domain/document/schema";
import { DOCUMENT_CHECKLISTS } from "@/lib/mocks/document-checklists";
import type { AddDocumentInput, DocumentRepository } from "../types";
import { touchCase, type MockStore } from "./store";

export class MockDocumentRepository implements DocumentRepository {
  constructor(
    private readonly store: MockStore,
    private readonly checklists: DocumentChecklistItem[] = DOCUMENT_CHECKLISTS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listChecklist(legalAreaId: string) {
    return this.checklists
      .filter((i) => i.legalAreaId === legalAreaId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listByCase(caseId: string) {
    return [...this.store.documents.values()]
      .filter((d) => d.caseId === caseId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((d) => structuredClone(d));
  }

  async add(input: AddDocumentInput, maxPerCase: number): Promise<CaseDocument | null> {
    // Contagem e inserção no mesmo trecho síncrono: duas inclusões simultâneas não
    // conseguem ultrapassar o limite. Banco (F5): transação com bloqueio do caso ou
    // gatilho de contagem.
    let count = 0;
    for (const d of this.store.documents.values()) if (d.caseId === input.caseId) count++;
    if (count >= maxPerCase) return null;
    const doc: CaseDocument = {
      id: crypto.randomUUID(),
      caseId: input.caseId,
      category: input.category,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      status: "uploaded",
      createdAt: this.now().toISOString(),
    };
    this.store.documents.set(doc.id, doc);
    touchCase(this.store, input.caseId, this.now());
    return structuredClone(doc);
  }

  async remove(caseId: string, documentId: string) {
    const doc = this.store.documents.get(documentId);
    if (!doc || doc.caseId !== caseId) return false;
    this.store.documents.delete(documentId);
    touchCase(this.store, caseId, this.now());
    return true;
  }
}
