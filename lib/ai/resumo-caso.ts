import "server-only";
import { generateText, Output } from "ai";
import type { Dossier } from "@/domain/dossier/schema";
import { resumoCasoSchema, type ResumoCaso } from "@/domain/ai/resumo";
import { aiModel } from "./client";

const INSTRUCAO =
  "Você organiza, para um advogado, o que já está escrito no dossiê de um atendimento " +
  "jurídico — nunca decide, nunca avalia mérito ou chance de sucesso. Nunca invente fato, " +
  "valor, prazo, nome, lei ou jurisprudência que não esteja literalmente no dossiê fornecido. " +
  "Se um dado não existir no dossiê, não o inclua — não adivinhe nem complete. " +
  "'riscosAparentes' cobre só o que é visível na própria estrutura do dossiê (ex.: prazo " +
  "relatado como próximo do vencimento, ausência de documento que o próprio dossiê já lista " +
  "como pendente) — nunca uma opinião jurídica sobre o mérito da causa.";

export type ResumoGerado = { resumo: ResumoCaso; modelo: string };

/**
 * Gera o resumo estruturado a partir do dossiê (já determinístico e fiel ao que o cidadão
 * informou — nunca da triagem bruta) — é por isso que o risco de alucinação aqui é baixo: a IA
 * só reorganiza dado que já existe, não produz argumento jurídico novo.
 */
export async function gerarResumoCaso(dossier: Dossier): Promise<ResumoGerado> {
  const model = aiModel();
  const resultado = await generateText({
    model,
    system: INSTRUCAO,
    prompt: `Dossiê do caso, em JSON:\n\n${JSON.stringify(dossier, null, 2)}`,
    output: Output.object({
      name: "resumo_caso",
      description: "Resumo estruturado de um caso, a partir do dossiê já organizado.",
      schema: resumoCasoSchema,
    }),
  });
  // .output lança NoOutputGeneratedError se o modelo não produzir saída válida contra o
  // schema — não precisa de checagem extra aqui, o chamador (gerarResumoIAAction) já captura.
  const modeloResolvido = resultado.finalStep.response?.modelId || model;
  return { resumo: resultado.output, modelo: modeloResolvido };
}
