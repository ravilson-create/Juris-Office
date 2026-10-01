import type { Applicant } from "@/domain/case/schema";
import type { AnswerMap } from "@/domain/triage/engine";
import { campo, listarPendencias, type PetitionDocument, type PetitionSection } from "@/domain/petition/schema";
import { SECAO_FECHO, SECAO_PROVAS, booleanAnswer, secaoValorCausa, secoesCabecalho, textoAnswer } from "./comum";

export type ModeloFamiliaId =
  | "familia.acao_alimentos"
  | "familia.regulamentacao_guarda"
  | "familia.divorcio_litigioso"
  | "familia.uniao_estavel"
  | "familia.partilha_bens";

const TITULOS: Record<ModeloFamiliaId, string> = {
  "familia.acao_alimentos": "Ação de Alimentos",
  "familia.regulamentacao_guarda": "Ação de Regulamentação de Guarda e Convivência",
  "familia.divorcio_litigioso": "Ação de Divórcio Litigioso",
  "familia.uniao_estavel": "Ação de Reconhecimento e Dissolução de União Estável",
  "familia.partilha_bens": "Ação de Partilha de Bens",
};

/**
 * Decide o(s) modelo(s) de petição a partir das respostas da triagem de família — nunca a
 * partir de texto livre. Um só "assunto" é obrigatório na triagem (domain/triage/schema), por
 * isso o resultado tem no máximo um modelo nesta fase.
 */
export function decidirModelosFamilia(answers: AnswerMap): ModeloFamiliaId[] {
  switch (answers["assunto"]) {
    case "pensao":
      return ["familia.acao_alimentos"];
    case "guarda":
      return ["familia.regulamentacao_guarda"];
    case "divorcio":
      return ["familia.divorcio_litigioso"];
    case "uniao_estavel":
      return ["familia.uniao_estavel"];
    case "partilha":
      return ["familia.partilha_bens"];
    default:
      return [];
  }
}

function secaoUrgencia(answers: AnswerMap): PetitionSection[] {
  if (!booleanAnswer(answers, "urgencia")) return [];
  const descricao = textoAnswer(answers, "urgencia_descricao");
  return [
    {
      chave: "tutela_urgencia",
      titulo: "Da Tutela de Urgência",
      corpo: `Diante da urgência da situação — ${campo(descricao, "descrição da urgência")} —, requer-se a concessão de tutela de urgência, nos termos do art. 300 do Código de Processo Civil, para que os efeitos do pedido sejam antecipados desde logo, por estarem presentes a probabilidade do direito e o perigo de dano.`,
    },
  ];
}

function secaoFatos(params: { answers: AnswerMap; corpo: string }): PetitionSection {
  return { chave: "dos_fatos", titulo: "Dos Fatos", corpo: params.corpo };
}

function gerarAcaoAlimentos(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const pessoas = campo(textoAnswer(answers, "pessoas_envolvidas"), "pessoas envolvidas e vínculo com o(a) autor(a)");
  const qtdFilhos = answers["quantidade_filhos"];
  const bens = booleanAnswer(answers, "bens_obrigacoes");
  return [
    secaoFatos({
      answers,
      corpo: `O(a) autor(a) necessita de alimentos para seu sustento${booleanAnswer(answers, "filhos_menores") ? ` e de seus dependentes (${campo(qtdFilhos ? String(qtdFilhos) : undefined, "quantidade de filhos/dependentes")})` : ""}. As pessoas envolvidas são: ${pessoas}. ${bens ? "Há bens ou obrigações financeiras relevantes a considerar na fixação do valor, conforme informado no atendimento." : ""}`,
    }),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "O dever de prestar alimentos decorre do art. 1.694 e seguintes do Código Civil e é regulado, quanto ao rito, pela Lei nº 5.478/1968 (Lei de Alimentos). Os alimentos devem ser fixados observando-se o binômio necessidade de quem recebe e possibilidade de quem presta, nos termos do art. 1.694, § 1º, do Código Civil.",
    },
    ...secaoUrgencia(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação, sob pena de revelia;\nb) a fixação de alimentos provisórios desde logo, nos termos do art. 4º da Lei nº 5.478/1968;\nc) ao final, a procedência do pedido, fixando-se os alimentos definitivos no valor a ser apurado, com desconto em folha de pagamento quando aplicável;\nd) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios.",
    },
    secaoValorCausa(campo(undefined, "valor da causa (12x o valor mensal de alimentos pretendido)")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarRegulamentacaoGuarda(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const pessoas = campo(textoAnswer(answers, "pessoas_envolvidas"), "pessoas envolvidas e vínculo com o(a) autor(a)");
  return [
    secaoFatos({
      answers,
      corpo: `Trata-se de pedido de regulamentação de guarda e convivência envolvendo: ${pessoas}. ${booleanAnswer(answers, "acordo_anterior") ? "Existe acordo anterior entre as partes, que não vem sendo observado ou precisa ser formalizado judicialmente." : "Não há acordo prévio entre as partes sobre o tema."}`,
    }),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "A guarda é regulada pelos arts. 1.583 a 1.590 do Código Civil e pelo Estatuto da Criança e do Adolescente (Lei nº 8.069/1990), que determinam a prevalência do melhor interesse da criança ou adolescente na definição da guarda e do regime de convivência.",
    },
    ...secaoUrgencia(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) a oitiva do Ministério Público, por se tratar de interesse de menor;\nc) ao final, a procedência do pedido, fixando-se a guarda e o regime de convivência nos termos a serem definidos, observado o melhor interesse do(a) menor;\nd) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios, caso resistida a pretensão.",
    },
    secaoValorCausa(campo(undefined, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarDivorcioLitigioso(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  const temFilhos = booleanAnswer(answers, "filhos_menores");
  const temBens = booleanAnswer(answers, "bens_obrigacoes");
  const pedidosAcessorios: string[] = [];
  if (temFilhos) {
    pedidosAcessorios.push(
      "- a fixação da guarda, do regime de convivência e dos alimentos em favor dos filhos menores;",
    );
  }
  if (temBens) {
    pedidosAcessorios.push("- a partilha dos bens comuns do casal, na forma a ser apurada;");
  }
  return [
    secaoFatos({
      answers,
      corpo: `O(a) autor(a) é ${campo(answers["relacao"] === "casamento" ? "casado(a)" : "convivente em união estável", "tipo de relação")} com a parte ré, não havendo consenso quanto à dissolução do vínculo${temFilhos ? ", à guarda e aos alimentos dos filhos menores" : ""}${temBens ? " nem quanto à partilha dos bens comuns" : ""}, conforme relatado no atendimento.`,
    }),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "O divórcio é direito potestativo assegurado pelo art. 226, § 6º, da Constituição Federal e pelo art. 1.571 do Código Civil, independendo de prazo de separação prévia ou de motivação. A ausência de consenso entre as partes não impede a decretação do divórcio, remetendo-se eventuais questões acessórias (guarda, alimentos, partilha) à instrução do feito.",
    },
    ...secaoUrgencia(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo: [
        "Diante do exposto, requer-se:",
        "- a citação da parte ré para, querendo, contestar a presente ação;",
        "- ao final, a decretação do divórcio do casal, com a volta do(a) autor(a) ao nome de solteiro(a), quando for o caso;",
        ...pedidosAcessorios,
        "- a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios, caso resistida a pretensão.",
      ].join("\n"),
    },
    secaoValorCausa(campo(undefined, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarUniaoEstavel(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  return [
    secaoFatos({
      answers,
      corpo: `O(a) autor(a) manteve união estável com a parte ré, convivendo de forma pública, contínua e duradoura, com o objetivo de constituição de família, conforme relatado no atendimento. ${campo(textoAnswer(answers, "pessoas_envolvidas"), "detalhes das pessoas envolvidas")}`,
    }),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "A união estável é reconhecida pelo art. 226, § 3º, da Constituição Federal e regulada pelos arts. 1.723 a 1.727 do Código Civil, que a definem como a convivência pública, contínua e duradoura, estabelecida com o objetivo de constituição de família.",
    },
    ...secaoUrgencia(answers),
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) ao final, o reconhecimento e a declaração da existência da união estável, com indicação do período de início e término;\nc) a dissolução da união estável, com a partilha de bens comuns, se houver;\nd) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios, caso resistida a pretensão.",
    },
    secaoValorCausa(campo(undefined, "valor da causa")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

function gerarPartilhaBens(applicant: Applicant, answers: AnswerMap): PetitionSection[] {
  return [
    secaoFatos({
      answers,
      corpo: `O vínculo entre o(a) autor(a) e a parte ré já foi dissolvido${booleanAnswer(answers, "processo_existente") ? ", havendo processo ou decisão judicial anterior sobre o relacionamento" : ""}, restando pendente a partilha dos bens comuns do casal.`,
    }),
    {
      chave: "do_direito",
      titulo: "Do Direito",
      corpo: "A partilha de bens, quando não resolvida por acordo entre as partes, deve ser decidida judicialmente, observando-se o regime de bens aplicável (arts. 1.639 e seguintes do Código Civil) e o princípio da comunhão dos aquestos, quando cabível.",
    },
    {
      chave: "dos_pedidos",
      titulo: "Dos Pedidos",
      corpo:
        "Diante do exposto, requer-se:\na) a citação da parte ré para, querendo, contestar a presente ação;\nb) ao final, a partilha dos bens comuns do casal, na proporção devida conforme o regime de bens aplicável;\nc) a condenação da parte ré ao pagamento das custas processuais e honorários advocatícios, caso resistida a pretensão.",
    },
    secaoValorCausa(campo(undefined, "valor da causa (metade do valor dos bens a partilhar)")),
    SECAO_PROVAS,
    SECAO_FECHO,
  ];
}

const GERADORES: Record<
  ModeloFamiliaId,
  (applicant: Applicant, answers: AnswerMap) => PetitionSection[]
> = {
  "familia.acao_alimentos": gerarAcaoAlimentos,
  "familia.regulamentacao_guarda": gerarRegulamentacaoGuarda,
  "familia.divorcio_litigioso": gerarDivorcioLitigioso,
  "familia.uniao_estavel": gerarUniaoEstavel,
  "familia.partilha_bens": gerarPartilhaBens,
};

export function gerarPeticaoFamilia(
  modeloId: ModeloFamiliaId,
  applicant: Applicant,
  answers: AnswerMap,
): PetitionDocument {
  const secoes = [
    ...secoesCabecalho({ varaLabel: "VARA DE FAMÍLIA", applicant }),
    ...GERADORES[modeloId](applicant, answers),
  ];
  return {
    modeloId,
    tituloModelo: TITULOS[modeloId],
    secoes,
    pendencias: listarPendencias(secoes),
  };
}
