import type { Applicant } from "@/domain/case/schema";
import type { LegalAreaSlug } from "@/domain/legal-area/schema";
import type { AnswerMap } from "@/domain/triage/engine";
import type { PetitionDocument } from "@/domain/petition/schema";
import { decidirModelosCivel, gerarPeticaoCivel, type ModeloCivelId } from "./civel";
import {
  decidirModelosConsumidor,
  gerarPeticaoConsumidor,
  type ModeloConsumidorId,
} from "./consumidor";
import { decidirModelosFamilia, gerarPeticaoFamilia, type ModeloFamiliaId } from "./familia";

/**
 * Ponto único de entrada da fase determinística: decide o modelo pela área + triagem e devolve
 * o documento já preenchido. Áreas ainda não implementadas devolvem lista vazia — a tela trata
 * isso como "nenhum modelo disponível para esta área ainda", nunca como erro.
 */
export function modelosDisponiveis(area: LegalAreaSlug, answers: AnswerMap): string[] {
  switch (area) {
    case "familia":
      return decidirModelosFamilia(answers);
    case "civel":
      return decidirModelosCivel(answers);
    case "consumidor":
      return decidirModelosConsumidor(answers);
    default:
      return [];
  }
}

export function gerarPeticao(
  area: LegalAreaSlug,
  modeloId: string,
  applicant: Applicant,
  answers: AnswerMap,
): PetitionDocument | null {
  if (area === "familia") {
    const permitidos = decidirModelosFamilia(answers);
    if (!permitidos.includes(modeloId as ModeloFamiliaId)) return null;
    return gerarPeticaoFamilia(modeloId as ModeloFamiliaId, applicant, answers);
  }
  if (area === "civel") {
    const permitidos = decidirModelosCivel(answers);
    if (!permitidos.includes(modeloId as ModeloCivelId)) return null;
    return gerarPeticaoCivel(modeloId as ModeloCivelId, applicant, answers);
  }
  if (area === "consumidor") {
    const permitidos = decidirModelosConsumidor(answers);
    if (!permitidos.includes(modeloId as ModeloConsumidorId)) return null;
    return gerarPeticaoConsumidor(modeloId as ModeloConsumidorId, applicant, answers);
  }
  return null;
}
