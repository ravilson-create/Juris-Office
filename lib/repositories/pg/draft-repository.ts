import { acceptsDraft, type DraftRecord, type DraftScope } from "@/domain/draft";
import type { Db } from "@/lib/db/types";
import type { DraftRepository } from "../types";
import { iso } from "./mappers";

export class PgDraftRepository implements DraftRepository {
  constructor(private readonly db: Db) {}

  async get(caseId: string, scope: DraftScope): Promise<DraftRecord | null> {
    const rows = await this.db.query(
      `SELECT * FROM case_drafts WHERE case_id = $1 AND scope = $2`,
      [caseId, scope],
    );
    return rows[0] ? toDraft(rows[0]) : null;
  }

  /** Decide e grava na mesma transação, com o caso bloqueado (ordem consistente entre abas). */
  async save(draft: DraftRecord): Promise<"saved" | "stale"> {
    return this.db.transaction(async (tx) => {
      const locked = await tx.query(`SELECT id FROM legal_cases WHERE id = $1 FOR UPDATE`, [
        draft.caseId,
      ]);
      if (!locked[0]) return "stale";
      const existing = await tx.query(
        `SELECT * FROM case_drafts WHERE case_id = $1 AND scope = $2`,
        [draft.caseId, draft.scope],
      );
      const commit = await tx.query(
        `SELECT committed_at FROM case_draft_commits WHERE case_id = $1 AND scope = $2`,
        [draft.caseId, draft.scope],
      );
      const current = existing[0] ? toDraft(existing[0]) : undefined;
      const committedAt = commit[0] ? iso(commit[0].committed_at) : undefined;
      if (!acceptsDraft(draft, current, committedAt)) return "stale";
      await tx.query(
        `INSERT INTO case_drafts (case_id, scope, draft_values, form_key, seq, base_time, saved_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
         ON CONFLICT (case_id, scope) DO UPDATE SET draft_values = EXCLUDED.draft_values,
           form_key = EXCLUDED.form_key, seq = EXCLUDED.seq, base_time = EXCLUDED.base_time,
           saved_at = EXCLUDED.saved_at`,
        [
          draft.caseId,
          draft.scope,
          JSON.stringify(draft.values),
          draft.formKey,
          draft.seq,
          draft.baseTime,
          draft.savedAt,
        ],
      );
      return "saved";
    });
  }

  async markCommitted(caseId: string, scope: DraftScope, at: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.query(`DELETE FROM case_drafts WHERE case_id = $1 AND scope = $2`, [caseId, scope]);
      await tx.query(
        `INSERT INTO case_draft_commits (case_id, scope, committed_at) VALUES ($1, $2, $3)
         ON CONFLICT (case_id, scope) DO UPDATE SET committed_at = EXCLUDED.committed_at`,
        [caseId, scope, at],
      );
    });
  }

  async deleteAllForCase(caseId: string): Promise<void> {
    await this.db.query(`DELETE FROM case_drafts WHERE case_id = $1`, [caseId]);
  }
}

function toDraft(r: Record<string, unknown>): DraftRecord {
  return {
    caseId: r.case_id as string,
    scope: r.scope as DraftScope,
    values: r.draft_values as DraftRecord["values"],
    formKey: r.form_key as string,
    seq: Number(r.seq),
    baseTime: iso(r.base_time),
    savedAt: iso(r.saved_at),
  };
}
