import type { TriageQuestion } from "@/domain/triage/schema";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { CIVEL_QUESTIONS } from "./civel";
import { CONSUMIDOR_QUESTIONS } from "./consumidor";
import { DOSSIER_HINTS } from "./dossier-hints";
import { FAMILIA_QUESTIONS } from "./familia";
import { PREVIDENCIARIO_QUESTIONS } from "./previdenciario";
import { TRABALHISTA_QUESTIONS } from "./trabalhista";

const slugById = new Map(LEGAL_AREAS.map((a) => [a.id, a.slug]));

/** Aplica as marcações de dossiê às perguntas de cada área. */
function withDossierHints(questions: TriageQuestion[]): TriageQuestion[] {
  return questions.map((q) => {
    const slug = slugById.get(q.legalAreaId);
    const hint = slug ? DOSSIER_HINTS[slug][q.key] : undefined;
    return hint ? { ...q, dossier: hint } : q;
  });
}

export const ALL_TRIAGE_QUESTIONS: TriageQuestion[] = withDossierHints([
  ...CONSUMIDOR_QUESTIONS,
  ...TRABALHISTA_QUESTIONS,
  ...FAMILIA_QUESTIONS,
  ...PREVIDENCIARIO_QUESTIONS,
  ...CIVEL_QUESTIONS,
]);
