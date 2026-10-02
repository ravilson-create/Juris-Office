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

/** Status em que o caso já passou da triagem do cidadão e é trabalho do escritório. */
export const STATUS_PROFISSIONAL: readonly CaseStatus[] = [
  "submitted",
  "under_legal_review",
  "needs_information",
  "accepted",
  "rejected",
  "in_negotiation",
  "active",
  "closed",
];

const BLOQUEADO_PARA_EXCLUSAO: readonly CaseStatus[] = [
  "accepted",
  "in_negotiation",
  "active",
  "closed",
];

/** Status em que o atendimento ainda pode ser excluído — antes de aceito/em andamento, quando
 * normalmente já existe contrato (a RLS aplica a mesma regra, ver migração 0017). */
export function isDeletable(status: CaseStatus): boolean {
  return !BLOQUEADO_PARA_EXCLUSAO.includes(status);
}

/**
 * Valida um status vindo de entrada não confiável (ex.: query string) contra a lista de status
 * que a tela do escritório realmente filtra — nunca aceita um status de cidadão (`draft` etc.)
 * nem um valor arbitrário.
 */
export function statusProfissionalValido(valor: string | undefined | null): CaseStatus | null {
  return STATUS_PROFISSIONAL.includes(valor as CaseStatus) ? (valor as CaseStatus) : null;
}

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  draft: "Rascunho",
  triage: "Em preenchimento (triagem)",
  awaiting_documents: "Em preenchimento (documentos)",
  ready_for_review: "Pronto para finalizar",
  submitted: "Finalizado (teste)",
  // Status usados pelo portal do advogado (painel e fila em /equipe, PRs 1 e 2):
  under_legal_review: "Em análise pelo advogado",
  needs_information: "Aguardando informações",
  accepted: "Causa aceita",
  rejected: "Causa não aceita",
  in_negotiation: "Contrato em negociação",
  active: "Em andamento",
  closed: "Encerrado",
};
