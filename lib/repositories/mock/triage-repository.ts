import type { TriageAnswer, TriageQuestion } from "@/domain/triage/schema";
import { ALL_TRIAGE_QUESTIONS } from "@/lib/mocks/triage";
import type { SaveAnswerInput, TriageRepository } from "../types";
import { touchCase, type MockStore } from "./store";

const answerKey = (caseId: string, questionKey: string) => `${caseId}:${questionKey}`;

export class MockTriageRepository implements TriageRepository {
  constructor(
    private readonly store: MockStore,
    private readonly questions: TriageQuestion[] = ALL_TRIAGE_QUESTIONS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listQuestions(legalAreaId: string) {
    return this.questions
      .filter((q) => q.legalAreaId === legalAreaId && q.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listAnswers(caseId: string) {
    return [...this.store.answers.values()]
      .filter((a) => a.caseId === caseId)
      .map((a) => structuredClone(a));
  }

  async saveAnswer({ caseId, question, value }: SaveAnswerInput): Promise<TriageAnswer> {
    const key = answerKey(caseId, question.key);
    const existing = this.store.answers.get(key);
    const timestamp = this.now().toISOString();
    const answer: TriageAnswer = {
      id: existing?.id ?? crypto.randomUUID(),
      caseId,
      questionId: question.id,
      questionKey: question.key,
      value,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.store.answers.set(key, answer);
    touchCase(this.store, caseId, this.now());
    return structuredClone(answer);
  }

  async deleteAnswers(caseId: string, questionKeys: string[]) {
    let removed = false;
    for (const k of questionKeys)
      removed = this.store.answers.delete(answerKey(caseId, k)) || removed;
    if (removed) touchCase(this.store, caseId, this.now());
  }
}
