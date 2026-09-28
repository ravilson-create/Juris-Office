import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { LegalCase } from "@/domain/case/schema";
import { isEditableByCitizen } from "@/domain/case/status";
import { canAccessCase } from "@/lib/auth/case-access";
import { getCaseService } from "./index";

/**
 * Carrega o caso para uma página da jornada. Mostra 404 se o ID for inválido, se o caso não
 * existir ou se não pertencer a este navegador (sem revelar qual dos três aconteceu).
 */
export async function loadCaseOr404(caseId: string) {
  if (!z.uuid().safeParse(caseId).success) notFound();
  const service = getCaseService();
  const overview = await service.getOverview(caseId);
  if (!overview || !(await canAccessCase(overview.legalCase))) notFound();
  return { service, ...overview };
}

/** Depois do envio, as telas de edição levam ao protocolo. */
export function redirectIfLocked(legalCase: LegalCase): void {
  if (!isEditableByCitizen(legalCase.status)) redirect(`/atendimento/${legalCase.id}/protocolo`);
}
