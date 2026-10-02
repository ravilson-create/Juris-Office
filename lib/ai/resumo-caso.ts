import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Dossier } from "@/domain/dossier/schema";
import { resumoCasoSchema, type ResumoCaso } from "@/domain/ai/resumo";
import { getAiClient } from "./client";

const MODEL = "claude-sonnet-5-5";

const INSTRUCAO =
  "Você organiza, para um advogado, o que já está escrito no dossiê de um atendimento " +
  "jurídico — nunca decide, nunca avalia mérito ou chance de sucesso. Nunca invente fato, " +
  "valor, prazo, nome, lei ou jurisprudência que não esteja literalmente no dossiê fornecido. " +
  "Se um dado não existir no dossiê, não o inclua — não adivinhe nem complete. " +
  "'riscosAparentes' cobre só o que é visível na própria estrutura do dossiê (ex.: prazo " +
  "relatado como próximo do vencimento, ausência de documento que o próprio dossiê já lista " +
  "como pendente) — nunca uma opinião jurídica sobre o mérito da causa.";

/**
 * Gera o resumo estruturado a partir do dossiê (já determinístico e fiel ao que o cidadão
 * informou — nunca da triagem bruta) — é por isso que o risco de alucinação aqui é baixo: a IA
 * só reorganiza dado que já existe, não produz argumento jurídico novo.
 */
export async function gerarResumoCaso(dossier: Dossier): Promise<ResumoCaso> {
  const client = getAiClient();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system: INSTRUCAO,
    messages: [
      {
        role: "user",
        content: `Dossiê do caso, em JSON:\n\n${JSON.stringify(dossier, null, 2)}`,
      },
    ],
    output_config: { format: zodOutputFormat(resumoCasoSchema) },
  });
  if (!response.parsed_output) {
    throw new Error("Não foi possível interpretar a resposta da IA.");
  }
  return response.parsed_output;
}
