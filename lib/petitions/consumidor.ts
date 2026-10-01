import type { Applicant } from "@/domain/case/schema";
import type { AnswerMap } from "@/domain/triage/engine";
import { campo, listarPendencias, type PetitionDocument, type PetitionSection } from "@/domain/petition/schema";
import {
  SECAO_FECHO,
  SECAO_PROVAS,
  booleanAnswer,
  secaoValorCausa,
  secoesCabecalho,
  textoAnswer,
  valorMonetarioAnswer,
} from "./comum";

export type ModeloConsumidorId =
  | "consumidor.declaratoria_inexistencia_negativacao"
  | "consumidor.declaratoria_inexistencia_cobranca"
  | "consumidor.obrigacao_fazer_produto_servico";

const TITULOS: Record<ModeloConsumidorId, string> = {
  "consumidor.declaratoria_inexistencia_negativacao":
    "Ação Declaratória de Inexistência de Débito c/c Indenização por Danos Morais",
  "consumidor.declaratoria_inexistencia_cobranca":
    "Ação Declaratória de Inexistência de Débito c/c Repetição de Indébito",
  "consumidor.obrigacao_fazer_produto_servico":
    "Ação de Obrigação de Fazer c/c Indenização por Danos Morais e Materiais",
};

function situacoes(answers: AnswerMap): string[] {
  const v = answers["cobranca_negativacao"];
  return Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Decide o modelo a partir de `cobranca_negativacao` (negativação > cobrança indevida > defeito
 * de produto/serviço como regra geral) — nunca de texto livre. Sempre decide um modelo: a
 * triagem de consumidor não tem uma opção "outro" para a situação central.
 */
export function decidirModelosConsumidor(answers: AnswerMap): ModeloConsumidorId[] {
  const s = situacoes(answers);
  if (s.includes("negativacao")) return ["consumidor.declaratoria_inexistencia_negativacao"];
  if (s.includes("cobranca")) return ["consumidor.declaratoria_inexistencia_cobranca"];
  return ["consumidor.obrigacao_fazer_produto_servico"];
}

function secaoFatos(corpo: string): PetitionSection {
  return { chave: "dos_fatos", titulo: "Dos Fatos", corpo };
}

function secaoTentativaResolucao(answers: AnswerMap): PetitionSection[] {
  if (!booleanAnswer(answers, "tentou_resolver")) return [];
  const protocolo = textoAnswer(answers, "numero_protocolo");
  const resultado = answers["houve_resposta"];
  const RESULTADO_TEXTO: Record<string, string> = {
    sem_resposta: "não obteve resposta do fornecedor",
    nao_resolveu: "obteve resposta, mas o problema não foi resolvido",
    parcial: "obteve apenas solução parcial do problema",
  };
  return [
    {
      chave: "da_tentativa_de_solucao",
      titulo: "Da Tentativa de Solução Extrajudicial",
      corpo: `A parte autora buscou solucionar a questão diretamente com o fornecedor${protocolo ? `, sob o protocolo nº ${protocolo}` : ""}, mas ${typeof resultado === "string" ? (RESULTADO_TEXTO[resultado] ?? "não obteve solução satisfatória") : "não obteve solução satisfatória"}, restando necessário o ajuizamento da presente ação.`,
    },
  ];
}

function gerarDeclaratoriaNegativacao(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const fornecedor = campo(textoAnswer(answers, "fornecedor"), "nome do fornecedor");
  const produto = campo(textoAnswer(answers, "produto_servico"), "produto ou serviço relacionado");
  const valor = valorMonetarioAnswer(answers, "valor_envolvido");
  const pagou = answers["pagamento_realizado"];
  return [
    secaoFatos(
      `A parte autora teve seu nome inscrito nos cadastros de proteção ao crédito (SPC/Serasa) por ${fornecedor}, em razão de débito relativo a ${produto}${valor ? `, no valor de ${valor}` : ""}, que entende indevido. ${campo(textoAnswer(answers, "problema"), "descrição detalhada do motivo pelo qual o débito é indevido")} ${pagou === "total" ? "A parte autora efetuou o pagamento integral, o que torna a cobrança e a negativação ainda mais indevidas." : ""}`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "Trata-se de relação de consumo, aplicando-se o Código de Defesa do Consumidor, inclusive a inversão do ônus da prova em favor do consumidor (art. 6º, VIII, do CDC). A manutenção de negativação indevida gera dano moral presumido (in re ipsa). Nos termos do art. 43, § 3º, do CDC, o fornecedor deve providenciar a correção do cadastro no prazo de 5 (cinco) dias úteis, sob pena de responsabilização. Havendo pagamento indevido, cabe a repetição em dobro do valor cobrado, nos termos do art. 42, parágrafo único, do CDC.",
    },
    {
      chave: "tutela_urgencia",
      titulo: "Da Tutela de Urgência",
      corpo: "Diante da probabilidade do direito, evidenciada pela indevida inscrição, e do perigo de dano decorrente da manutenção do nome da parte autora nos cadastros restritivos, requer-se a concessão de tutela de urgência, nos termos do art. 300 do Código de Processo Civil, para determinar a exclusão imediata do nome da parte autora dos cadastros de proteção ao crédito (SPC/Serasa) em relação ao débito ora discutido.",
    },
    ...secaoTentativaResolucao(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a concessão de tutela de urgência para exclusão do nome da parte autora dos cadastros de proteção ao crédito quanto ao débito discutido;\nb) a citação da parte ré para, querendo, contestar a presente ação;\nc) a procedência do pedido, declarando-se a inexistência do débito e tornando definitiva a exclusão do nome da parte autora dos cadastros restritivos;\nd) a condenação da parte ré ao pagamento de indenização por danos morais, em montante a ser arbitrado por este Juízo;\ne) caso comprovado pagamento do débito indevido, a condenação da parte ré à repetição em dobro do valor pago, nos termos do art. 42, parágrafo único, do CDC;\nf) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(valor, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarDeclaratoriaCobranca(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const fornecedor = campo(textoAnswer(answers, "fornecedor"), "nome do fornecedor");
  const produto = campo(textoAnswer(answers, "produto_servico"), "produto ou serviço relacionado");
  const valor = valorMonetarioAnswer(answers, "valor_envolvido");
  const pagou = answers["pagamento_realizado"];
  return [
    secaoFatos(
      `A parte ré, ${fornecedor}, vem cobrando da parte autora valor que esta entende indevido, relativo a ${produto}${valor ? `, no importe de ${valor}` : ""}. ${campo(textoAnswer(answers, "problema"), "descrição detalhada do motivo pelo qual a cobrança é indevida")} ${pagou === "total" || pagou === "parcial" ? "A parte autora chegou a efetuar pagamento, ainda que a cobrança seja indevida." : "A parte autora não efetuou o pagamento."}`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "Trata-se de relação de consumo, regida pelo Código de Defesa do Consumidor, com inversão do ônus da prova em favor do consumidor (art. 6º, VIII, do CDC). A cobrança de valor indevido autoriza a declaração de inexistência do débito e, havendo pagamento, a repetição em dobro da quantia paga, nos termos do art. 42, parágrafo único, do CDC, salvo engano justificável do fornecedor.",
    },
    ...secaoTentativaResolucao(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) a procedência do pedido, declarando-se a inexistência do débito cobrado;\nc) caso comprovado pagamento, a condenação da parte ré à repetição em dobro do valor pago, nos termos do art. 42, parágrafo único, do CDC;\nd) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(valor, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarObrigacaoFazerProdutoServico(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const fornecedor = campo(textoAnswer(answers, "fornecedor"), "nome do fornecedor");
  const produto = campo(textoAnswer(answers, "produto_servico"), "produto ou serviço relacionado");
  const valor = valorMonetarioAnswer(answers, "valor_envolvido");
  const continuaIndicacao = booleanAnswer(answers, "problema_continua")
    ? "O problema persiste até o momento."
    : "O problema foi contornado, mas sem solução definitiva por parte do fornecedor.";
  return [
    secaoFatos(
      `A parte autora adquiriu/contratou ${produto} de ${fornecedor}${valor ? `, pelo valor de ${valor}` : ""}, apresentando o seguinte problema: ${campo(textoAnswer(answers, "problema"), "descrição do problema")} ${continuaIndicacao}`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "Trata-se de relação de consumo, com inversão do ônus da prova em favor do consumidor (art. 6º, VIII, do CDC). Constatado vício no produto ou serviço, o fornecedor responde nos termos dos arts. 18 e 20 do CDC, cabendo ao consumidor exigir, à sua escolha, a reexecução do serviço, a substituição do produto, a restituição do valor pago ou o abatimento proporcional do preço. A responsabilidade do fornecedor por defeito do produto ou serviço é objetiva, nos termos dos arts. 12 e 14 do CDC.",
    },
    ...secaoTentativaResolucao(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) a procedência do pedido, condenando-se a parte ré, à escolha da parte autora, a reexecutar o serviço, substituir o produto ou restituir o valor pago, corrigido monetariamente;\nc) a condenação da parte ré ao pagamento de indenização por danos morais, caso configurados, em montante a ser arbitrado por este Juízo;\nd) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(valor, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

const GERADORES: Record<
  ModeloConsumidorId,
  (applicant: Applicant, answers: AnswerMap) => PetitionSection[]
> = {
  "consumidor.declaratoria_inexistencia_negativacao": gerarDeclaratoriaNegativacao,
  "consumidor.declaratoria_inexistencia_cobranca": gerarDeclaratoriaCobranca,
  "consumidor.obrigacao_fazer_produto_servico": gerarObrigacaoFazerProdutoServico,
};

export function gerarPeticaoConsumidor(
  modeloId: ModeloConsumidorId,
  applicant: Applicant,
  answers: AnswerMap,
): PetitionDocument {
  const parteRe = textoAnswer(answers, "fornecedor");
  const secoes = [
    ...secoesCabecalho({ varaLabel: "VARA CÍVEL", applicant, parteRe }),
    ...GERADORES[modeloId](applicant, answers),
  ];
  return {
    modeloId,
    tituloModelo: TITULOS[modeloId],
    secoes,
    pendencias: listarPendencias(secoes),
  };
}
