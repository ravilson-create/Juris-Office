import { describe, expect, it } from "vitest";
import { buildSteps } from "@/domain/triage/engine";
import { triageQuestionSchema } from "@/domain/triage/schema";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { ALL_TRIAGE_QUESTIONS } from "@/lib/mocks/triage";

describe.each(LEGAL_AREAS.map((a) => [a.name, a] as const))("perguntas de %s", (_name, area) => {
  const questions = ALL_TRIAGE_QUESTIONS.filter((q) => q.legalAreaId === area.id);

  it("existem e passam no schema", () => {
    expect(questions.length).toBeGreaterThanOrEqual(8);
    for (const q of questions) {
      const r = triageQuestionSchema.safeParse(q);
      expect(r.success, `${q.key}: ${r.error?.message}`).toBe(true);
    }
  });

  it("têm chaves e IDs únicos", () => {
    expect(new Set(questions.map((q) => q.key)).size).toBe(questions.length);
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
  });

  it("condições apontam para perguntas anteriores da mesma área", () => {
    for (const q of questions.filter((x) => x.showIf)) {
      const ref = questions.find((x) => x.key === q.showIf!.questionKey);
      expect(ref, `${q.key} → ${q.showIf!.questionKey}`).toBeDefined();
      expect(ref!.sortOrder).toBeLessThan(q.sortOrder);
      if (ref!.type === "boolean") expect(typeof q.showIf!.equals).toBe("boolean");
      if (ref!.type === "single_choice") {
        expect(ref!.options!.map((o) => o.value)).toContain(q.showIf!.equals);
      }
    }
  });

  it("são divididas em ao menos duas etapas", () => {
    expect(buildSteps(questions).length).toBeGreaterThanOrEqual(2);
  });
});

it("IDs de pergunta são únicos entre todas as áreas", () => {
  expect(new Set(ALL_TRIAGE_QUESTIONS.map((q) => q.id)).size).toBe(ALL_TRIAGE_QUESTIONS.length);
});
