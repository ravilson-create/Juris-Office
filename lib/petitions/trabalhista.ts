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

export type ModeloTrabalhistaId = "trabalhista.reclamacao_trabalhista";

/**
 * Diferente das outras áreas, a triagem de trabalhista sempre resolve numa única peça — a
 * Reclamação Trabalhista — que varia só nos pedidos cumulados (reconhecimento de vínculo,
 * horas extras, FGTS etc.), decididos em gerarPeticaoTrabalhista() a partir das respostas.
 */
export function decidirModelosTrabalhista(_answers: AnswerMap): ModeloTrabalhistaId[] {
  return ["trabalhista.reclamacao_trabalhista"];
}

const PEDIDOS_VALORES: Record<string, string> = {
  horas_extras: "o pagamento das horas extras habitualmente prestadas e não quitadas, com os reflexos legais (DSR, 13º salário, férias e FGTS)",
  ferias: "o pagamento das férias vencidas e/ou proporcionais, acrescidas do terço constitucional",
  decimo_terceiro: "o pagamento do(s) 13º salário(s) em aberto, integral ou proporcional",
  fgts: "o recolhimento dos depósitos de FGTS não efetuados durante o contrato",
  rescisao: "o pagamento das verbas rescisórias em aberto (saldo de salário, aviso prévio, férias e 13º proporcionais)",
  outros: "o pagamento dos demais valores devidos e não quitados, a serem apurados em liquidação",
};

function listaValoresNaoPagos(answers: AnswerMap): string[] {
  const v = answers["valores_nao_pagos"];
  return Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : [];
}

function secaoFatos(applicant: Applicant, answers: AnswerMap): PetitionSection {
  const empregador = campo(textoAnswer(answers, "empregador"), "nome do empregador");
  const funcao = campo(textoAnswer(answers, "funcao"), "função exercida");
  const inicio = campo(textoAnswer(answers, "data_inicio"), "data de início do contrato");
  const aindaTrabalha = booleanAnswer(answers, "ainda_trabalha");
  const termino = aindaTrabalha
    ? "O contrato de trabalho está em curso até a presente data."
    : `O contrato foi encerrado em ${campo(textoAnswer(answers, "data_termino"), "data de término do contrato")}.`;
  const registro = answers["registro_formal"];
  const registroTexto =
    registro === "sim"
      ? "O contrato foi registrado em carteira desde o início."
      : registro === "parcial"
        ? "O registro em carteira só ocorreu depois de um tempo trabalhado sem anotação."
        : "O contrato nunca foi anotado em carteira de trabalho, embora presentes os requisitos da relação de emprego (subordinação, pessoalidade, não eventualidade e onerosidade).";
  const jornada = textoAnswer(answers, "jornada");
  return {
    chave: "dos_fatos",
    titulo: "Dos Fatos",
    corpo: `A parte reclamante foi admitida por ${empregador} para exercer a função de ${funcao}, a partir de ${inicio}. ${termino} ${registroTexto}${jornada ? ` A jornada habitual era: ${jornada}.` : ""} ${booleanAnswer(answers, "controle_ponto") ? "Havia controle de ponto, cujos registros deverão ser exibidos pela parte reclamada." : "Não havia controle de ponto formal."}`,
  };
}

function secaoDoDireito(answers: AnswerMap): PetitionSection {
  const registro = answers["registro_formal"];
  const vinculoNaoReconhecido = registro !== "sim";
  return {
    chave: "do_direito",
    titulo: "Do Direito",
    corpo: `${
      vinculoNaoReconhecido
        ? "Presentes os requisitos dos arts. 2º e 3º da CLT — subordinação, pessoalidade, não eventualidade e onerosidade —, impõe-se o reconhecimento do vínculo empregatício e a anotação na Carteira de Trabalho e Previdência Social (CTPS), nos termos do art. 29 da CLT. "
        : ""
    }Os direitos trabalhistas são assegurados pelo art. 7º da Constituição Federal e pela Consolidação das Leis do Trabalho (CLT), que garantem, entre outros, o pagamento de horas extras (art. 59 da CLT), férias com acréscimo de um terço (art. 7º, XVII, da CF), 13º salário (Lei nº 4.090/1962) e depósitos de FGTS (Lei nº 8.036/1990). A rescisão sem justa causa dá direito, ainda, à multa de 40% sobre os depósitos de FGTS (art. 18, § 1º, da Lei nº 8.036/1990) e à liberação das guias para levantamento do FGTS e habilitação ao seguro-desemprego (art. 477 da CLT).`,
  };
}

function pedidosList(answers: AnswerMap): string[] {
  const pedidos = ["a citação da parte reclamada para, querendo, apresentar defesa no prazo legal"];
  const registro = answers["registro_formal"];
  if (registro !== "sim") {
    pedidos.push(
      "o reconhecimento do vínculo empregatício desde a data de início informada, com a anotação da função, salário e data de admissão na CTPS da parte reclamante",
    );
  }
  for (const valor of listaValoresNaoPagos(answers)) {
    if (PEDIDOS_VALORES[valor]) pedidos.push(PEDIDOS_VALORES[valor]);
  }
  const aindaTrabalha = booleanAnswer(answers, "ainda_trabalha");
  const formaDesligamento = answers["forma_desligamento"];
  if (!aindaTrabalha && formaDesligamento === "sem_justa_causa" && !booleanAnswer(answers, "documentos_rescisorios")) {
    pedidos.push(
      "a entrega das guias para levantamento do FGTS (chave de conectividade social) e para habilitação ao seguro-desemprego, ou, na impossibilidade, a condenação da parte reclamada ao pagamento dos valores correspondentes",
    );
  }
  pedidos.push(
    "a condenação da parte reclamada ao pagamento das custas processuais e, se cabível, dos honorários advocatícios sucumbenciais",
  );
  return pedidos;
}

export function gerarPeticaoTrabalhista(
  _modeloId: ModeloTrabalhistaId,
  applicant: Applicant,
  answers: AnswerMap,
): PetitionDocument {
  const empregador = textoAnswer(answers, "empregador");
  const pedidos = pedidosList(answers)
    .map((texto, index) => `${String.fromCharCode(97 + index)}) ${texto};`)
    .join("\n");
  const secoes: PetitionSection[] = [
    ...secoesCabecalho({ varaLabel: "VARA DO TRABALHO", applicant, parteRe: empregador }),
    secaoFatos(applicant, answers),
    secaoDoDireito(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo: `Diante do exposto, requer-se:\n${pedidos}`,
    },
    secaoValorCausa(valorMonetarioAnswer(answers, "remuneracao") ?? campo(undefined, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
  return {
    modeloId: "trabalhista.reclamacao_trabalhista",
    tituloModelo: "Reclamação Trabalhista",
    secoes,
    pendencias: listarPendencias(secoes),
  };
}
