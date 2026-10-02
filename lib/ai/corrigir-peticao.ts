import "server-only";
import { generateText, Output } from "ai";
import { correcaoSecaoSchema } from "@/domain/ai/correcao-peticao";
import { aiModel } from "./client";

const INSTRUCAO =
  "Você corrige a redação de uma seção de petição inicial brasileira para o formato oficial " +
  "esperado pela área e pelo tipo de ação informados — endereçamento, terminologia própria da " +
  "área, estrutura e formalidade. Você NUNCA inventa fato, valor, data, nome, lei ou " +
  "jurisprudência que não esteja literalmente no texto recebido: só reescreve a forma do que já " +
  "está ali. Qualquer trecho no formato [PENDENTE: ...] deve ser copiado exatamente como está, " +
  "sem preencher nem remover.";

export type CorrecaoSecaoGerada = { corpoCorrigido: string; modelo: string };

/**
 * Corrige a redação de uma única seção da petição (F3, segunda peça) — nunca a petição inteira
 * de uma vez, para que o advogado avalie e aceite seção a seção antes de aplicar.
 */
export async function gerarCorrecaoSecao(input: {
  areaNome: string;
  tituloModelo: string;
  tituloSecao: string;
  corpoAtual: string;
}): Promise<CorrecaoSecaoGerada> {
  const model = aiModel();
  const resultado = await generateText({
    model,
    system: INSTRUCAO,
    prompt:
      `Área: ${input.areaNome}\n` +
      `Tipo de ação: ${input.tituloModelo}\n` +
      `Seção: ${input.tituloSecao}\n\n` +
      `Texto atual da seção:\n${input.corpoAtual}`,
    output: Output.object({
      name: "correcao_secao",
      description: "Texto corrigido de uma seção de petição inicial, no formato oficial.",
      schema: correcaoSecaoSchema,
    }),
  });
  const modeloResolvido = resultado.finalStep.response?.modelId || model;
  return { corpoCorrigido: resultado.output.corpoCorrigido, modelo: modeloResolvido };
}
