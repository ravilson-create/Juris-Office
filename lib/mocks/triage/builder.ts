import type { LegalAreaSlug } from "@/domain/legal-area/schema";
import type { TriageQuestion } from "@/domain/triage/schema";
import { areaId } from "@/lib/mocks/legal-areas";
import { stableId } from "@/lib/utils/stable-id";

type QuestionSeed = Omit<TriageQuestion, "id" | "legalAreaId" | "sortOrder" | "active" | "section">;

/** Monta perguntas de uma área a partir de seções, com IDs e ordem estáveis. */
export function defineQuestions(
  slug: LegalAreaSlug,
  sections: Array<{ title: string; questions: QuestionSeed[] }>,
): TriageQuestion[] {
  let order = 0;
  return sections.flatMap((section) =>
    section.questions.map((q) => ({
      ...q,
      id: stableId(`question:${slug}:${q.key}`),
      legalAreaId: areaId(slug),
      section: section.title,
      sortOrder: (order += 10),
      active: true,
    })),
  );
}
