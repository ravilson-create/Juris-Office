import "server-only";
import { generateText, tool } from "ai";
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
    // O modelo configurado aceita ferramentas, mas não response_format/json_schema.
    // A ferramenta apenas transporta os campos: não executa nem grava dados.
    tools: {
      resumo_caso: tool({
        description: "Organize o resumo do dossiê nestes campos, sem acrescentar fatos.",
        inputSchema: resumoCasoSchema,
      }),
    },
    toolChoice: { type: "tool", toolName: "resumo_caso" },
  });
  const chamada = resultado.toolCalls.find((call) => call.toolName === "resumo_caso");
  if (!chamada || chamada.invalid) throw new Error("IA não retornou um resumo válido.");
  const resumo = resumoCasoSchema.parse(chamada.input);
  const modeloResolvido = resultado.finalStep.response?.modelId || model;
  return { resumo, modelo: modeloResolvido };
}
