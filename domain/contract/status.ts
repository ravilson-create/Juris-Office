import type { ContractStatus } from "./schema";

/**
 * "signed" ainda não é alcançável por nenhuma transição: o aceite eletrônico com trilha de
 * auditoria (hash, IP, data) é a próxima peça do plano (PR5), e só ela leva um contrato a
 * "signed". Até lá, draft/sent/cancelled é o ciclo completo desta PR.
 */
const TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["cancelled"],
  signed: [],
  cancelled: [],
};

export function canTransitionContract(from: ContractStatus, to: ContractStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export class InvalidContractTransitionError extends Error {
  constructor(
    public readonly from: ContractStatus,
    public readonly to: ContractStatus,
  ) {
    super(`Transição de status de contrato inválida: ${from} → ${to}`);
    this.name = "InvalidContractTransitionError";
  }
}

export function assertContractTransition(from: ContractStatus, to: ContractStatus): void {
  if (!canTransitionContract(from, to)) {
    throw new InvalidContractTransitionError(from, to);
  }
}
