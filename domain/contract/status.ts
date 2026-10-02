import type { ContractStatus } from "./schema";

/**
 * "signed" só é alcançável a partir de "sent", e só pela trilha de aceite eletrônico
 * (lib/services/equipe-contratos.ts#assinarContrato) — nunca por uma troca de status direta,
 * que é o que a RLS de contracts (ver migração 0012) também impede.
 */
const TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["signed", "cancelled"],
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
