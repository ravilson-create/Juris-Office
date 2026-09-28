import { z } from "zod";

const labelled = z.object({ question: z.string(), answer: z.string() });

/**
 * Dossiê jurídico preliminar (Sprint 3 — montagem determinística, sem IA).
 * É um retrato do caso no momento do envio: guarda os textos já formatados,
 * para que alterações futuras de perguntas ou checklists não mudem dossiês emitidos.
 */
export const dossierSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  version: z.number().int().positive(),
  protocol: z.string(),
  areaName: z.string(),
  applicant: z.object({
    fullName: z.string(),
    email: z.string(),
    phone: z.string(),
    city: z.string(),
    uf: z.string(),
  }),
  /** 2. Síntese do relato (trecho inicial). O relato completo é preservado em `narrative`. */
  factsSummary: z.string(),
  narrative: z.string(),
  /** 3. Informações da triagem, na ordem das etapas. */
  triageSections: z.array(z.object({ title: z.string(), items: z.array(labelled) })),
  /** 4. Partes mencionadas. */
  parties: z.array(z.object({ name: z.string(), role: z.string() })),
  /** 5. Linha do tempo (datas ISO AAAA-MM-DD, em ordem crescente). */
  chronology: z.array(z.object({ date: z.string().optional(), description: z.string() })),
  /** 6. Valores informados (já formatados em reais). */
  amounts: z.array(z.object({ label: z.string(), value: z.string() })),
  /** 7. Documentos. */
  documents: z.array(z.object({ category: z.string(), name: z.string() })),
  /** 8. Providências já tomadas. */
  actionsTaken: z.array(labelled),
  /** 9. Informações ainda necessárias. */
  missingInformation: z.array(z.string()),
  /** 10. Observações. */
  observations: z.array(z.string()),
  /** 11. Aviso de revisão profissional. */
  disclaimer: z.string(),
  createdAt: z.iso.datetime(),
});
export type Dossier = z.infer<typeof dossierSchema>;

export const DOSSIER_DISCLAIMER =
  "Este documento é uma organização preliminar das informações fornecidas pelo usuário e não constitui parecer jurídico, garantia de direito, previsão de resultado ou substituição da análise de profissional habilitado.";
