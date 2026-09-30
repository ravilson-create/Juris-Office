import type { Applicant, LegalCase } from "@/domain/case/schema";
import type { CaseDocument, DocumentChecklistItem } from "@/domain/document/schema";
import { OTHER_DOCUMENTS_CATEGORY } from "@/domain/document/schema";
import type { LegalArea } from "@/domain/legal-area/schema";
import { buildSteps, formatAnswer, isVisible, type AnswerMap } from "@/domain/triage/engine";
import type { TriageQuestion } from "@/domain/triage/schema";
import { businessDate, compareCivilDates } from "@/domain/time";
import { DOSSIER_DISCLAIMER, type Dossier } from "./schema";

export const FACTS_SUMMARY_MAX = 500;

export interface DossierInput {
  id: string;
  version: number;
  legalCase: LegalCase & { applicant: Applicant; narrative: string };
  area: LegalArea;
  questions: TriageQuestion[];
  answers: AnswerMap;
  documents: CaseDocument[];
  checklist: DocumentChecklistItem[];
  otherDocumentsLabel: string;
  now: Date;
}

/** Corta o texto no limite, preferindo o fim de uma frase ou palavra. */
export function summarize(text: string, max = FACTS_SUMMARY_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentenceEnd >= max * 0.6) return slice.slice(0, sentenceEnd + 1);
  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : max).replace(/[,;:]$/, "")}…`;
}

/**
 * Monta o dossiê de forma determinística: mesma entrada, mesmo resultado.
 * Nada é inventado — tudo vem das respostas, do relato e dos documentos informados.
 */
export function buildDossier(input: DossierInput): Dossier {
  const { legalCase, area, answers } = input;
  const active = input.questions.filter((q) => q.active);
  const visible = active.filter((q) => isVisible(q, answers));
  const answered = visible.filter((q) => answers[q.key] !== undefined && answers[q.key] !== "");

  const triageSections = buildSteps(active)
    .map((step) => ({
      title: step.title,
      items: step.questions
        .filter((q) => isVisible(q, answers))
        .map((q) => ({ question: q.label, answer: formatAnswer(q, answers[q.key]) })),
    }))
    .filter((s) => s.items.length > 0);

  const parties: Dossier["parties"] = [
    { name: legalCase.applicant.fullName, role: "Interessado(a)" },
  ];
  const chronology: Dossier["chronology"] = [];
  const amounts: Dossier["amounts"] = [];
  const actionsTaken: Dossier["actionsTaken"] = [];

  for (const q of answered) {
    const hint = q.dossier;
    const value = answers[q.key];
    if (!hint) continue;
    switch (hint.kind) {
      case "party":
        if (hint.fixedName) {
          if (value === true) parties.push({ name: hint.fixedName, role: hint.role });
        } else if (typeof value === "string" && value.trim()) {
          parties.push({ name: value.trim(), role: hint.role });
        }
        break;
      case "date":
        if (typeof value === "string") chronology.push({ date: value, description: hint.event });
        break;
      case "amount":
        amounts.push({ label: hint.label, value: formatAnswer(q, value) });
        break;
      case "action":
        actionsTaken.push({ question: q.label, answer: formatAnswer(q, value) });
        break;
    }
  }
  // A finalização é sempre o último evento conhecido.
  chronology.sort((a, b) => compareCivilDates(a.date ?? "", b.date ?? ""));
  chronology.push({
    date: businessDate(input.now),
    description: "Atendimento de teste finalizado no Júris Office IA",
  });

  const categoryLabel = (category: string) =>
    category === OTHER_DOCUMENTS_CATEGORY
      ? input.otherDocumentsLabel
      : (input.checklist.find((i) => i.category === category)?.label ?? category);
  const documents = input.documents.map((d) => ({
    category: categoryLabel(d.category),
    name: d.originalName,
  }));

  const sent = new Set(input.documents.map((d) => d.category));
  const missingInformation = [
    ...visible
      .filter((q) => !q.required && (answers[q.key] === undefined || answers[q.key] === ""))
      .map((q) => `Não informado: ${q.label}`),
    ...input.checklist
      .filter((i) => i.recommended && !sent.has(i.category))
      .map((i) => `Documento recomendado não registrado: ${i.label}`),
  ];
  if (chronology.length === 1) missingInformation.push("Datas dos fatos não informadas.");

  const observations = [
    "Dossiê gerado em ambiente de testes. O acesso profissional depende de encaminhamento ao advogado responsável.",
    "Resumo montado automaticamente a partir das respostas do interessado, sem uso de inteligência artificial.",
  ];
  if (documents.length > 0) {
    observations.push(
      "Versão de testes: os documentos listados foram apenas registrados para simulação (nome, tipo e tamanho); nenhum arquivo foi recebido.",
    );
  }

  return {
    id: input.id,
    caseId: legalCase.id,
    version: input.version,
    protocol: legalCase.protocol,
    areaName: area.name,
    applicant: {
      fullName: legalCase.applicant.fullName,
      email: legalCase.applicant.email,
      phone: legalCase.applicant.phone,
      city: legalCase.applicant.city,
      uf: legalCase.applicant.uf,
    },
    factsSummary: summarize(legalCase.narrative),
    narrative: legalCase.narrative,
    triageSections,
    parties,
    chronology,
    amounts,
    documents,
    actionsTaken,
    missingInformation,
    observations,
    disclaimer: DOSSIER_DISCLAIMER,
    createdAt: input.now.toISOString(),
  };
}
