import type { Applicant } from "@/domain/case/schema";
import type { AnswerMap } from "@/domain/triage/engine";
import { campo, listarPendencias, type PetitionDocument, type PetitionSection } from "@/domain/petition/schema";
import { SECAO_FECHO, SECAO_PROVAS, booleanAnswer, secaoValorCausa, secoesCabecalho, textoAnswer } from "./comum";

export type ModeloPrevidenciarioId =
  | "previdenciario.concessao_aposentadoria"
  | "previdenciario.concessao_incapacidade"
  | "previdenciario.restabelecimento_incapacidade"
  | "previdenciario.concessao_pensao_morte"
  | "previdenciario.concessao_bpc"
  | "previdenciario.concessao_maternidade"
  | "previdenciario.revisao_beneficio";

const TITULOS: Record<ModeloPrevidenciarioId, string> = {
  "previdenciario.concessao_aposentadoria": "Ação de Concessão de Aposentadoria",
  "previdenciario.concessao_incapacidade": "Ação de Concessão de Benefício por Incapacidade",
  "previdenciario.restabelecimento_incapacidade": "Ação de Restabelecimento de Benefício por Incapacidade",
  "previdenciario.concessao_pensao_morte": "Ação de Concessão de Pensão por Morte",
  "previdenciario.concessao_bpc": "Ação de Concessão de Benefício Assistencial (BPC/LOAS)",
  "previdenciario.concessao_maternidade": "Ação de Concessão de Salário-Maternidade",
  "previdenciario.revisao_beneficio": "Ação Revisional de Benefício Previdenciário",
};

/** O réu é sempre o INSS — não depende de nenhum dado informado na triagem. */
const INSS = "Instituto Nacional do Seguro Social (INSS), autarquia federal";

/**
 * Decide o modelo a partir de `beneficio` (+ `resultado`, só para distinguir concessão de
 * restabelecimento em incapacidade) — nunca de texto livre. `beneficio: "outro"` ou ausente não
 * decide nenhum modelo, igual a família/cível.
 */
export function decidirModelosPrevidenciario(answers: AnswerMap): ModeloPrevidenciarioId[] {
  switch (answers["beneficio"]) {
    case "aposentadoria":
      return ["previdenciario.concessao_aposentadoria"];
    case "incapacidade":
      return answers["resultado"] === "cessado"
        ? ["previdenciario.restabelecimento_incapacidade"]
        : ["previdenciario.concessao_incapacidade"];
    case "pensao_morte":
      return ["previdenciario.concessao_pensao_morte"];
    case "bpc":
      return ["previdenciario.concessao_bpc"];
    case "maternidade":
      return ["previdenciario.concessao_maternidade"];
    case "revisao":
      return ["previdenciario.revisao_beneficio"];
    default:
      return [];
  }
}

function secaoFatos(answers: AnswerMap): PetitionSection {
  const requereu = booleanAnswer(answers, "requerimento_inss");
  const dataPedido = textoAnswer(answers, "data_requerimento");
  const numero = textoAnswer(answers, "numero_beneficio");
  const resultado = answers["resultado"];
  const RESULTADO_TEXTO: Record<string, string> = {
    aguardando: "o pedido ainda está em análise no INSS",
    negado: "o pedido foi indeferido pelo INSS",
    valor: "o benefício foi concedido, mas em valor que a parte autora entende incorreto",
    cessado: "o benefício foi concedido e, posteriormente, cessado pelo INSS",
    nao_pedi: "o pedido administrativo ainda não foi formalizado",
  };
  const motivo = textoAnswer(answers, "motivo_informado");
  return {
    chave: "dos_fatos",
    titulo: "Dos Fatos",
    corpo: `A parte autora ${requereu ? `formulou requerimento administrativo ao INSS${dataPedido ? `, em ${dataPedido}` : ""}${numero ? `, sob o nº ${numero}` : ""}` : "não chegou a formalizar requerimento administrativo, ou este não foi localizado"}. ${typeof resultado === "string" ? (RESULTADO_TEXTO[resultado] ?? "") : ""}. ${motivo ? `O INSS fundamentou o indeferimento da seguinte forma: ${motivo}.` : ""} ${!booleanAnswer(answers, "recurso_andamento") ? "Não há recurso ou prazo administrativo em andamento, estando esgotada a via administrativa." : "Há recurso ou prazo administrativo ainda em curso, que não impede o ajuizamento da presente ação diante da garantia de acesso ao Judiciário (art. 5º, XXXV, da CF)."}`,
  };
}

function secaoTutelaUrgencia(answers: AnswerMap): PetitionSection[] {
  const resultado = answers["resultado"];
  if (resultado !== "negado" && resultado !== "cessado") return [];
  return [
    {
      chave: "tutela_urgencia",
      titulo: "Da Tutela de Urgência",
      corpo: "Diante da probabilidade do direito, evidenciada pelos documentos que instruem esta petição, e do perigo de dano decorrente da ausência de renda para subsistência da parte autora, requer-se a concessão de tutela de urgência, nos termos do art. 300 do Código de Processo Civil, para determinar a imediata implantação (ou o restabelecimento) do benefício, independentemente do trânsito em julgado.",
    },
  ];
}

function gerarGenerico(
  fundamentoDireito: string,
  pedidoEspecifico: string,
): (applicant: Applicant, answers: AnswerMap) => PetitionSection[] {
  return (_applicant, answers) => [
    secaoFatos(answers),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: fundamentoDireito,
    },
    ...secaoTutelaUrgencia(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo: `Diante do exposto, requer-se:\na) a citação do réu para, querendo, apresentar defesa;\nb) ${pedidoEspecifico};\nc) o pagamento dos valores em atraso desde a data do requerimento administrativo (ou da citação, na ausência de requerimento prévio), corrigidos monetariamente e com juros de mora;\nd) a condenação do réu ao pagamento dos honorários advocatícios, ressalvada a isenção de custas processuais de que goza o segurado.`,
    },
    secaoValorCausa(campo(undefined, "valor da causa (12x o valor mensal do benefício pretendido)")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function secaoComplementoCnis(answers: AnswerMap): string {
  return booleanAnswer(answers, "possui_cnis")
    ? " O extrato do CNIS acompanha esta petição, comprovando o histórico contributivo da parte autora."
    : " O extrato do CNIS será requerido/juntado posteriormente, comprovando o histórico contributivo da parte autora.";
}

const GERADORES: Record<
  ModeloPrevidenciarioId,
  (applicant: Applicant, answers: AnswerMap) => PetitionSection[]
> = {
  "previdenciario.concessao_aposentadoria": (applicant, answers) =>
    gerarGenerico(
      `O direito à aposentadoria é regulado pelos arts. 48 a 57 da Lei nº 8.213/1991, que estabelecem os requisitos para aposentadoria por idade, por tempo de contribuição e especial, conforme a modalidade cabível ao caso.${secaoComplementoCnis(answers)}`,
      "a concessão da aposentadoria, na modalidade cabível, com implantação imediata do benefício",
    )(applicant, answers),
  "previdenciario.concessao_incapacidade": (applicant, answers) =>
    gerarGenerico(
      "O benefício por incapacidade (auxílio por incapacidade temporária ou aposentadoria por invalidez) é regulado pelos arts. 59 a 63 da Lei nº 8.213/1991, exigindo a comprovação da incapacidade para o trabalho, da qualidade de segurado e, quando exigido, do período de carência. A incapacidade deve ser comprovada por laudo médico e, se necessário, por perícia judicial.",
      "a concessão do benefício por incapacidade, com implantação imediata, convertendo-se em aposentadoria por invalidez caso constatada incapacidade total e permanente",
    )(applicant, answers),
  "previdenciario.restabelecimento_incapacidade": (applicant, answers) =>
    gerarGenerico(
      "A cessação administrativa do benefício por incapacidade, quando não precedida de comprovação de recuperação da capacidade laborativa, viola os arts. 59 a 63 da Lei nº 8.213/1991. Persistindo a incapacidade, cabe o restabelecimento do benefício desde a data da cessação indevida.",
      "o restabelecimento do benefício por incapacidade desde a data da cessação, com implantação imediata",
    )(applicant, answers),
  "previdenciario.concessao_pensao_morte": (applicant, answers) =>
    gerarGenerico(
      "A pensão por morte é regulada pelos arts. 74 a 79 da Lei nº 8.213/1991, devida aos dependentes do segurado falecido, independentemente de carência, desde que comprovada a qualidade de segurado do instituidor e a condição de dependente da parte autora.",
      "a concessão da pensão por morte, com implantação imediata do benefício em favor da parte autora",
    )(applicant, answers),
  "previdenciario.concessao_bpc": (applicant, answers) =>
    gerarGenerico(
      "O Benefício de Prestação Continuada (BPC/LOAS) é regulado pelo art. 20 da Lei nº 8.742/1993, devido ao idoso ou pessoa com deficiência que comprove não possuir meios de prover a própria manutenção nem de tê-la provida por sua família, independentemente de contribuição prévia à Previdência Social.",
      "a concessão do Benefício de Prestação Continuada (BPC/LOAS), com implantação imediata",
    )(applicant, answers),
  "previdenciario.concessao_maternidade": (applicant, answers) =>
    gerarGenerico(
      "O salário-maternidade é regulado pelos arts. 71 a 73 da Lei nº 8.213/1991, devido à segurada gestante, adotante ou que tenha obtido guarda judicial para fins de adoção, pelo período legal de afastamento.",
      "a concessão do salário-maternidade, com pagamento integral do período devido",
    )(applicant, answers),
  "previdenciario.revisao_beneficio": (applicant, answers) =>
    gerarGenerico(
      "A revisão de benefício já concedido é cabível quando constatado erro no cálculo da renda mensal inicial ou na aplicação da legislação vigente à época da concessão, observado o prazo decadencial de 10 (dez) anos previsto no art. 103 da Lei nº 8.213/1991.",
      "a revisão do benefício, com recálculo da renda mensal de acordo com os critérios legais corretos e pagamento das diferenças devidas",
    )(applicant, answers),
};

export function gerarPeticaoPrevidenciario(
  modeloId: ModeloPrevidenciarioId,
  applicant: Applicant,
  answers: AnswerMap,
): PetitionDocument {
  const secoes = [
    ...secoesCabecalho({ varaLabel: "VARA FEDERAL", applicant, parteRe: INSS }),
    ...GERADORES[modeloId](applicant, answers),
  ];
  return {
    modeloId,
    tituloModelo: TITULOS[modeloId],
    secoes,
    pendencias: listarPendencias(secoes),
  };
}
