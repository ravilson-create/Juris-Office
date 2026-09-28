import { acceptsDraft, type DraftRecord, type DraftScope } from "@/domain/draft";
import type { DraftRepository } from "../types";
import type { MockStore } from "./store";

const key = (caseId: string, scope: DraftScope) => `${caseId}|${scope}`;

export class MockDraftRepository implements DraftRepository {
  constructor(private readonly store: MockStore) {}

  async get(caseId: string, scope: DraftScope) {
    const d = this.store.drafts.get(key(caseId, scope));
    return d ? structuredClone(d) : null;
  }

  async save(draft: DraftRecord): Promise<"saved" | "stale"> {
    // Decisão e gravação no mesmo trecho síncrono (atômico no processo único).
    const k = key(draft.caseId, draft.scope);
    if (!acceptsDraft(draft, this.store.drafts.get(k), this.store.draftCommits.get(k))) {
      return "stale";
    }
    this.store.drafts.set(k, structuredClone(draft));
    return "saved";
  }

  async markCommitted(caseId: string, scope: DraftScope, at: string) {
    const k = key(caseId, scope);
    this.store.drafts.delete(k);
    this.store.draftCommits.set(k, at);
  }

  async deleteAllForCase(caseId: string) {
    for (const k of [...this.store.drafts.keys()]) {
      if (k.startsWith(`${caseId}|`)) this.store.drafts.delete(k);
    }
  }
}
