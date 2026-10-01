import { z } from "zod";

/**
 * Petição gerada no formato determinístico (fase 1, sem IA): um documento é uma sequência de
 * seções nomeadas, cada uma com o texto já preenchido com os dados do atendimento — ou marcado
 * como pendente quando o dado não foi informado. Nunca inventa fato, valor ou nome.
 */
export const petitionSectionSchema = z.object({
  chave: z.string().min(1),
  titulo: z.string().min(1),
  corpo: z.string(),
});
export type PetitionSection = z.infer<typeof petitionSectionSchema>;

export const petitionDocumentSchema = z.object({
  modeloId: z.string().min(1),
  tituloModelo: z.string().min(1),
  secoes: z.array(petitionSectionSchema).min(1),
  /** Rótulos dos campos que ficaram em aberto — mostrados ao advogado antes de exportar. */
  pendencias: z.array(z.string()),
});
export type PetitionDocument = z.infer<typeof petitionDocumentSchema>;

export const PENDENCIA_PREFIXO = "PENDENTE:";

/** Devolve o valor informado ou marca o campo como pendente — nunca inventa um valor. */
export function campo(valor: string | number | undefined | null, rotulo: string): string {
  const texto = valor === undefined || valor === null ? "" : String(valor).trim();
  return texto ? texto : `[${PENDENCIA_PREFIXO} ${rotulo}]`;
}

/** Extrai os rótulos pendentes de um conjunto de seções já preenchidas. */
export function listarPendencias(secoes: PetitionSection[]): string[] {
  const regex = new RegExp(`\\[${PENDENCIA_PREFIXO} ([^\\]]+)\\]`, "g");
  const encontrados = new Set<string>();
  for (const secao of secoes) {
    for (const match of secao.corpo.matchAll(regex)) encontrados.add(match[1]);
  }
  return [...encontrados];
}
