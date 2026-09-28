import type { CaseDocument, DocumentChecklistItem } from "@/domain/document/schema";
import type { Db } from "@/lib/db/types";
import { DOCUMENT_CHECKLISTS } from "@/lib/mocks/document-checklists";
import { NotFoundError, type AddDocumentInput, type DocumentRepository } from "../types";
import { toDocument } from "./mappers";

export class PgDocumentRepository implements DocumentRepository {
  constructor(
    private readonly db: Db,
    private readonly checklists: DocumentChecklistItem[] = DOCUMENT_CHECKLISTS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listChecklist(legalAreaId: string) {
    return this.checklists
      .filter((i) => i.legalAreaId === legalAreaId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listByCase(caseId: string): Promise<CaseDocument[]> {
    const rows = await this.db.query(
      `SELECT * FROM case_documents WHERE case_id = $1 ORDER BY created_at, id`,
      [caseId],
    );
    return rows.map(toDocument);
  }

  /**
   * Contagem e inserção na mesma transação, com a linha do caso bloqueada: duas inclusões
   * simultâneas (mesmo de instâncias diferentes) se enfileiram e o limite nunca é ultrapassado.
   */
  async add(input: AddDocumentInput, maxPerCase: number): Promise<CaseDocument | null> {
    const ts = this.now().toISOString();
    return this.db.transaction(async (tx) => {
      const locked = await tx.query(`SELECT id FROM legal_cases WHERE id = $1 FOR UPDATE`, [
        input.caseId,
      ]);
      if (!locked[0]) throw new NotFoundError("Caso", input.caseId);
      const [{ n }] = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM case_documents WHERE case_id = $1`,
        [input.caseId],
      );
      if (n >= maxPerCase) return null;
      const rows = await tx.query(
        `INSERT INTO case_documents (id, case_id, category, original_name, mime_type, size, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'uploaded', $7) RETURNING *`,
        [
          crypto.randomUUID(),
          input.caseId,
          input.category,
          input.originalName,
          input.mimeType ?? null,
          input.size,
          ts,
        ],
      );
      await tx.query(
        `UPDATE legal_cases SET revision = revision + 1, updated_at = $2 WHERE id = $1`,
        [input.caseId, ts],
      );
      return toDocument(rows[0]);
    });
  }

  async remove(caseId: string, documentId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx.query(`SELECT id FROM legal_cases WHERE id = $1 FOR UPDATE`, [caseId]);
      const removed = await tx.query(
        `DELETE FROM case_documents WHERE id = $1 AND case_id = $2 RETURNING id`,
        [documentId, caseId],
      );
      if (removed.length === 0) return false;
      await tx.query(
        `UPDATE legal_cases SET revision = revision + 1, updated_at = $2 WHERE id = $1`,
        [caseId, this.now().toISOString()],
      );
      return true;
    });
  }
}
