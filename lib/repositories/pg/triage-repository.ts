import type { TriageAnswer, TriageQuestion } from "@/domain/triage/schema";
import { PG_FOREIGN_KEY_VIOLATION, pgErrorCode, type Db } from "@/lib/db/types";
import { ALL_TRIAGE_QUESTIONS } from "@/lib/mocks/triage";
import { NotFoundError, type SaveAnswerInput, type TriageRepository } from "../types";
import { toAnswer } from "./mappers";

/** Perguntas continuam no código (catálogo); só as respostas vão para o banco. */
export class PgTriageRepository implements TriageRepository {
  constructor(
    private readonly db: Db,
    private readonly questions: TriageQuestion[] = ALL_TRIAGE_QUESTIONS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listQuestions(legalAreaId: string) {
    return this.questions
      .filter((q) => q.legalAreaId === legalAreaId && q.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listAnswers(caseId: string): Promise<TriageAnswer[]> {
    const rows = await this.db.query(`SELECT * FROM triage_answers WHERE case_id = $1`, [caseId]);
    return rows.map(toAnswer);
  }

  async saveAnswer({ caseId, question, value }: SaveAnswerInput): Promise<TriageAnswer> {
    const ts = this.now().toISOString();
    try {
      return await this.db.transaction(async (tx) => {
        const rows = await tx.query(
          `INSERT INTO triage_answers (case_id, question_key, id, question_id, value, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
           ON CONFLICT (case_id, question_key) DO UPDATE
             SET question_id = EXCLUDED.question_id, value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
           RETURNING *`,
          [caseId, question.key, crypto.randomUUID(), question.id, JSON.stringify(value), ts],
        );
        await tx.query(
          `UPDATE legal_cases SET revision = revision + 1, updated_at = $2 WHERE id = $1`,
          [caseId, ts],
        );
        return toAnswer(rows[0]);
      });
    } catch (error) {
      if (pgErrorCode(error) === PG_FOREIGN_KEY_VIOLATION) throw new NotFoundError("Caso", caseId);
      throw error;
    }
  }

  async deleteAnswers(caseId: string, questionKeys: string[]): Promise<void> {
    if (questionKeys.length === 0) return;
    await this.db.transaction(async (tx) => {
      const removed = await tx.query(
        `DELETE FROM triage_answers WHERE case_id = $1 AND question_key = ANY($2::text[]) RETURNING question_key`,
        [caseId, questionKeys],
      );
      if (removed.length > 0) {
        await tx.query(
          `UPDATE legal_cases SET revision = revision + 1, updated_at = $2 WHERE id = $1`,
          [caseId, this.now().toISOString()],
        );
      }
    });
  }
}
