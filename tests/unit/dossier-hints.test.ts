import { describe, expect, it } from "vitest";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { ALL_TRIAGE_QUESTIONS } from "@/lib/mocks/triage";
import { DOSSIER_HINTS } from "@/lib/mocks/triage/dossier-hints";

const COMPATIBLE: Record<string, string[]> = {
  party: ["text", "textarea"],
  date: ["date"],
  amount: ["currency", "number"],
  action: ["text", "textarea", "boolean", "single_choice", "multiple_choice", "date"],
};

describe.each(LEGAL_AREAS.map((a) => [a.slug, a] as const))(
  "marcações de dossiê — %s",
  (slug, area) => {
    const questions = ALL_TRIAGE_QUESTIONS.filter((q) => q.legalAreaId === area.id);

    it("apontam para perguntas existentes, com tipo compatível", () => {
      for (const [key, hint] of Object.entries(DOSSIER_HINTS[slug])) {
        const q = questions.find((x) => x.key === key);
        expect(q, `${slug}.${key} não existe`).toBeDefined();
        const allowed =
          hint.kind === "party" && hint.fixedName ? ["boolean"] : COMPATIBLE[hint.kind];
        expect(allowed, `${slug}.${key}: ${hint.kind} em pergunta ${q!.type}`).toContain(q!.type);
        expect(q!.dossier).toEqual(hint);
      }
    });

    it("identificam ao menos uma parte ou uma data", () => {
      const kinds = Object.values(DOSSIER_HINTS[slug]).map((h) => h.kind);
      expect(kinds.some((k) => k === "party" || k === "date")).toBe(true);
    });
  },
);
