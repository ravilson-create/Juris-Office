import { z } from "zod";

/**
 * Resumo de caso gerado por IA (Fase F3). Saída estruturada, nunca texto livre solto — e nunca
 * uma decisão: é leitura de apoio para o advogado abrir o dossiê já sabendo o que procurar,
 * sempre revisada antes de qualquer decisão de viabilidade ou peça.
 */
export const resumoCasoSchema = z.object({
  sintese: z.string().min(1).describe("Resumo em até 3 frases do que o caso trata."),
  pedidoPrincipal: z.string().min(1).describe("O que o cidadão quer, na própria perspectiva dele."),
  pontosChave: z
    .array(z.string().min(1))
    .min(1)
    .max(8)
    .describe("Fatos ou dados relevantes já presentes no dossiê, um por item."),
  documentosFaltantes: z
    .array(z.string().min(1))
    .describe("Documentos ou informações que o dossiê já lista como pendentes."),
  riscosAparentes: z
    .array(z.string().min(1))
    .describe("Riscos ou pontos de atenção visíveis apenas pelos dados já informados (prazo, prova, competência) — nunca uma avaliação de mérito ou chance de sucesso."),
});
export type ResumoCaso = z.infer<typeof resumoCasoSchema>;
