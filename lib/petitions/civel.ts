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

export type ModeloCivelId =
  | "civel.rescisao_contratual"
  | "civel.acao_cobranca"
  | "civel.indenizacao_danos"
  | "civel.despejo_cobranca_alugueis"
  | "civel.obrigacao_fazer_nao_fazer";

const TITULOS: Record<ModeloCivelId, string> = {
  "civel.rescisao_contratual": "Ação de Rescisão Contratual c/c Indenização por Danos Materiais e Morais",
  "civel.acao_cobranca": "Ação de Cobrança",
  "civel.indenizacao_danos": "Ação de Indenização por Danos Morais e Materiais",
  "civel.despejo_cobranca_alugueis": "Ação de Despejo c/c Cobrança de Aluguéis",
  "civel.obrigacao_fazer_nao_fazer": "Ação de Obrigação de Fazer/Não Fazer",
};

/** Decide o modelo a partir do `tipo_conflito` da triagem de cível — nunca de texto livre. */
export function decidirModelosCivel(answers: AnswerMap): ModeloCivelId[] {
  switch (answers["tipo_conflito"]) {
    case "contrato":
      return ["civel.rescisao_contratual"];
    case "divida":
      return ["civel.acao_cobranca"];
    case "danos":
      return ["civel.indenizacao_danos"];
    case "imovel":
      return ["civel.despejo_cobranca_alugueis"];
    case "vizinhanca":
      return ["civel.obrigacao_fazer_nao_fazer"];
    default:
      return [];
  }
}

function secaoFatos(corpo: string): PetitionSection {
  return { chave: "dos_fatos", titulo: "Dos Fatos", corpo };
}

function secaoTentativaAcordo(answers: AnswerMap): PetitionSection[] {
  if (!booleanAnswer(answers, "notificacao_acordo")) return [];
  return [
    {
      chave: "da_tentativa_de_acordo",
      titulo: "Da Tentativa de Solução Extrajudicial",
      corpo: "A parte autora buscou solucionar a questão extrajudicialmente, por meio de notificação ou tentativa de acordo com a parte ré, que não surtiu efeito, restando necessário o ajuizamento da presente ação.",
    },
  ];
}

function contextoComum(answers: AnswerMap) {
  const partes = campo(textoAnswer(answers, "partes"), "qualificação completa do(a) réu(é)");
  const valor = valorMonetarioAnswer(answers, "valor_envolvido");
  const existeContrato = booleanAnswer(answers, "existe_contrato");
  const houvePagamento = booleanAnswer(answers, "houve_pagamento");
  return { partes, valor, existeContrato, houvePagamento };
}

function gerarRescisaoContratual(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const { partes, valor, houvePagamento } = contextoComum(answers);
  return [
    secaoFatos(
      `A parte autora firmou contrato, escrito ou verbal, com ${partes}, o qual não vem sendo cumprido conforme pactuado. ${houvePagamento ? "Houve pagamento por parte da autora, que não teve a contrapartida devida." : "Não houve pagamento até o momento."} ${campo(undefined, "descrição detalhada do descumprimento contratual")}`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "O inadimplemento contratual autoriza a parte prejudicada a requerer a rescisão do contrato cumulada com perdas e danos, nos termos dos arts. 389, 395 e 475 do Código Civil. Comprovado o descumprimento, impõe-se a responsabilização civil da parte inadimplente, inclusive por eventuais danos morais, quando configurados.",
    },
    ...secaoTentativaAcordo(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) a procedência do pedido, decretando-se a rescisão do contrato por culpa da parte ré;\nc) a condenação da parte ré à restituição dos valores pagos e à reparação dos danos materiais e morais sofridos, em montante a ser arbitrado;\nd) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(valor, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarAcaoCobranca(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const { partes, valor, existeContrato } = contextoComum(answers);
  return [
    secaoFatos(
      `A parte ré, ${partes}, é devedora da parte autora no valor de ${campo(valor, "valor da dívida")}, ${existeContrato ? "conforme contrato firmado entre as partes" : "conforme relatado no atendimento"}, não tendo honrado o pagamento até o momento.`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "A obrigação de pagar quantia certa, uma vez vencida e não adimplida, autoriza a cobrança judicial do valor devido, acrescido de correção monetária, juros de mora e, quando cabível, multa contratual, nos termos dos arts. 389 e 394 do Código Civil.",
    },
    ...secaoTentativaAcordo(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) a procedência do pedido, condenando-se a parte ré ao pagamento do valor devido, corrigido monetariamente e acrescido de juros de mora desde o vencimento;\nc) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(valor, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarIndenizacaoDanos(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const { partes, valor } = contextoComum(answers);
  return [
    secaoFatos(
      `A parte ré, ${partes}, deu causa a danos à parte autora, conforme relatado no atendimento. ${campo(undefined, "descrição detalhada do dano e do nexo de causalidade")}`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "A responsabilidade civil por ato ilícito, prevista nos arts. 186 e 927 do Código Civil, impõe o dever de indenizar a quem, por ação ou omissão voluntária, negligência ou imprudência, causar dano a outrem. Comprovados o ato, o dano e o nexo causal, impõe-se a reparação material e, quando configurada violação a direito da personalidade, também moral.",
    },
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) a procedência do pedido, condenando-se a parte ré ao pagamento de indenização por danos materiais, no valor a ser apurado, e por danos morais, em montante a ser arbitrado por este Juízo;\nc) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(valor, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarDespejoCobranca(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const { partes, valor } = contextoComum(answers);
  return [
    secaoFatos(
      `Trata-se de relação locatícia entre a parte autora e ${partes}, com inadimplemento de aluguéis e/ou encargos da locação. [PENDENTE: confirmar se a parte autora é locador(a) ou locatário(a) — o modelo abaixo pressupõe locador(a) cobrando aluguéis em atraso e requerendo o despejo].`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "A ação de despejo por falta de pagamento, cumulada com cobrança de aluguéis e encargos, é regulada pela Lei nº 8.245/1991 (Lei do Inquilinato), que autoriza o locador a retomar o imóvel e cobrar os valores em aberto diante do inadimplemento do locatário.",
    },
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação, com a faculdade de emenda da mora, se cabível;\nb) a procedência do pedido, decretando-se o despejo e condenando-se a parte ré ao pagamento dos aluguéis e encargos em atraso, corrigidos monetariamente e acrescidos de juros de mora;\nc) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(valor, "valor da causa (soma dos aluguéis e encargos vencidos)")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarObrigacaoFazerNaoFazer(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const { partes } = contextoComum(answers);
  return [
    secaoFatos(
      `A parte ré, ${partes}, vem praticando conduta que afeta o sossego, a saúde ou a segurança da parte autora, caracterizando conflito de vizinhança. ${campo(undefined, "descrição detalhada da conduta e de seus efeitos")}`,
    ),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "O uso da propriedade deve respeitar os limites impostos pelo direito de vizinhança, nos termos dos arts. 1.277 e seguintes do Código Civil, que asseguram ao proprietário ou possuidor o direito de fazer cessar interferências prejudiciais à segurança, ao sossego e à saúde causadas pela utilização de propriedade vizinha.",
    },
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) a procedência do pedido, condenando-se a parte ré a fazer ou deixar de fazer o necessário para cessar a interferência, sob pena de multa diária a ser arbitrada;\nc) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(undefined, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

const GERADORES: Record<ModeloCivelId, (applicant: Applicant, answers: AnswerMap) => PetitionSection[]> = {
  "civel.rescisao_contratual": gerarRescisaoContratual,
  "civel.acao_cobranca": gerarAcaoCobranca,
  "civel.indenizacao_danos": gerarIndenizacaoDanos,
  "civel.despejo_cobranca_alugueis": gerarDespejoCobranca,
  "civel.obrigacao_fazer_nao_fazer": gerarObrigacaoFazerNaoFazer,
};

export function gerarPeticaoCivel(
  modeloId: ModeloCivelId,
  applicant: Applicant,
  answers: AnswerMap,
): PetitionDocument {
  const parteRe = textoAnswer(answers, "partes");
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
