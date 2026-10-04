import "server-only";
import { generateText, Output } from "ai";
import { auxilioCampoPecaSchema } from "@/domain/ai/auxilio-campo-peca";
import { aiModel } from "./client";

const INSTRUCAO =
  "Você ajuda um advogado brasileiro a redigir, em linguagem jurídica formal, o conteúdo de UM " +
  "campo do formulário de uma peça processual, a partir de uma anotação informal dele sobre o " +
  "fato. Você NUNCA inventa fato, valor, data, nome, lei ou jurisprudência que não esteja " +
  "literalmente na anotação recebida: só reescreve a forma do que já foi informado, no padrão " +
  "de uma petição. Devolve só o texto do campo, nunca um documento inteiro nem endereçamento.";

export type AuxilioCampoPecaGerado = { textoAuxiliado: string; modelo: string };

/**
 * Transforma a anotação informal do advogado num campo livre do formulário de peças
 * (ver domain/pecas/schema.ts#CAMPOS_PECA) em texto no padrão jurídico — nunca o documento
 * inteiro, só este campo. Mesma cota mensal de auxílio da IA da correção de seções (migração
 * 0025/0030), consumida em app/equipe/[caseId]/pecas/actions.ts antes de chamar esta função.
 */
export async function gerarAuxilioCampoPeca(input: {
  tituloPeca: string;
  rotuloCampo: string;
  notaAdvogado: string;
}): Promise<AuxilioCampoPecaGerado> {
  const model = aiModel();
  const resultado = await generateText({
    model,
    system: INSTRUCAO,
    prompt:
      `Peça: ${input.tituloPeca}\n` +
      `Campo: ${input.rotuloCampo}\n\n` +
      `Anotação do advogado:\n${input.notaAdvogado}`,
    output: Output.object({
      name: "auxilio_campo_peca",
      description: "Texto do campo da peça processual, no padrão jurídico, a partir da anotação do advogado.",
      schema: auxilioCampoPecaSchema,
    }),
  });
  const modeloResolvido = resultado.finalStep.response?.modelId || model;
  return { textoAuxiliado: resultado.output.textoAuxiliado, modelo: modeloResolvido };
}
