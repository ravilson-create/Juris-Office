import type { CaseStatus } from "./schema";

/**
 * Transições permitidas no ciclo de vida do caso
 * (Módulo 1 — cliente, Módulo 2 — definição da causa, início do Módulo 3 — contrato).
 */
const TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  draft: ["triage"],
  triage: ["awaiting_documents", "ready_for_review"],
  awaiting_documents: ["ready_for_review", "triage"],
  ready_for_review: ["submitted", "triage", "awaiting_documents"],
  submitted: ["under_legal_review"],
  under_legal_review: ["needs_information", "accepted", "rejected"],
  needs_information: ["under_legal_review"],
  accepted: ["in_negotiation"],
  rejected: ["closed"],
  in_negotiation: ["active", "closed"],
  active: ["closed"],
  closed: [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly from: CaseStatus,
    public readonly to: CaseStatus,
  ) {
    super(`Transição de status inválida: ${from} → ${to}`);
    this.name = "InvalidStatusTransitionError";
  }
}

export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

const CITIZEN_EDITABLE: readonly CaseStatus[] = [
  "draft",
  "triage",
  "awaiting_documents",
  "ready_for_review",
  "needs_information",
];

/** Status em que o cidadão ainda pode editar o próprio atendimento. */
export function isEditableByCitizen(status: CaseStatus): boolean {
  return CITIZEN_EDITABLE.includes(status);
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  draft: "Rascunho",
  triage: "Em preenchimento (triagem)",
  awaiting_documents: "Em preenchimento (documentos)",
  ready_for_review: "Pronto para finalizar",
  submitted: "Recebido · aguardando análise",
  under_legal_review: "Em análise pelo advogado",
  needs_information: "Aguardando informações",
  accepted: "Causa aceita",
  rejected: "Causa não aceita",
  in_negotiation: "Contrato em negociação",
  active: "Em andamento",
  closed: "Encerrado",
};
