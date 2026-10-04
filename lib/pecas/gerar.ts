import { campo, type PetitionDocument } from "@/domain/petition/schema";
import { CAMPOS_PECA, TITULO_PECA, type TipoPeca } from "@/domain/pecas/schema";
import {
  enderecamentoJuizo,
  enderecamentoTribunal,
  enderecamentoTurmaRecursal,
  fechoPeca,
  qualificacaoResumida,
  type ContextoPeca,
} from "./comum";

/** Valores dos campos livres do formulário (ver domain/pecas/schema.ts#CAMPOS_PECA), já
 * indexados por chave — o gerador só decide ONDE cada um entra no documento, nunca complementa
 * ou deduz o que falta: campo vazio vira [PENDENTE: ...], igual ao padrão da petição inicial. */
export type ValoresCamposPeca = Record<string, string>;

/** O rótulo vem sempre de CAMPOS_PECA (fonte única) — nunca duplicado aqui, para a pendência
 * mostrada ao advogado nunca dessincronizar do rótulo do formulário que a gerou. */
function campoDe(tipo: TipoPeca, valores: ValoresCamposPeca, chave: string): string {
  const def = CAMPOS_PECA[tipo].find((c) => c.chave === chave)!;
  return campo(valores[chave], def.rotulo);
}

function documento(tipo: TipoPeca, secoes: PetitionDocument["secoes"]): PetitionDocument {
  return {
    modeloId: `peca.${tipo}`,
    tituloModelo: TITULO_PECA[tipo],
    secoes,
    pendencias: [],
  };
}

function gerarReplica(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("replica", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte autora"),
    {
      chave: "da_contestacao",
      titulo: "Da Síntese da Contestação",
      corpo: `A parte ré apresentou contestação, alegando, em síntese: ${campoDe("replica", c, "pontosContestacao")}`,
    },
    {
      chave: "da_impugnacao",
      titulo: "Da Impugnação",
      corpo: "Nenhum dos argumentos da contestação é capaz de afastar o direito da parte autora, pelos fundamentos já expostos na petição inicial, que aqui se reiteram e passam a integrar esta réplica.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o prosseguimento do feito, com a improcedência das teses defensivas e a procedência dos pedidos formulados na petição inicial.",
    },
    fechoPeca(),
  ]);
}

function gerarAgravoTutela(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("agravo_tutela", [
    enderecamentoTribunal(ctx),
    qualificacaoResumida(ctx, "parte agravante"),
    {
      chave: "da_decisao_agravada",
      titulo: "Da Decisão Agravada",
      corpo: `A decisão agravada indeferiu o pedido de tutela de urgência, nos seguintes termos: ${campoDe("agravo_tutela", c, "decisaoAgravada")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "O presente recurso é cabível nos termos do art. 1.015, I, do Código de Processo Civil, que prevê o agravo de instrumento contra decisões interlocutórias que versem sobre tutelas provisórias.",
    },
    {
      chave: "do_fundamento",
      titulo: "Da Reforma da Decisão",
      corpo: `${campoDe("agravo_tutela", c, "fundamentoReforma")} Além disso, o perigo de dano ou o risco ao resultado útil do processo está evidenciado: ${campoDe("agravo_tutela", c, "periculumInMora")}`,
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o conhecimento e provimento do presente agravo, para reformar a decisão agravada e conceder a tutela de urgência pleiteada.",
    },
    fechoPeca(),
  ]);
}

function gerarEmbargosDeclaracao(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("embargos_declaracao", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte embargante"),
    {
      chave: "do_vicio",
      titulo: "Do Vício a Sanar",
      corpo: `A decisão, no trecho a seguir, padece de omissão, contradição ou obscuridade: "${campoDe("embargos_declaracao", c, "trechoDecisao")}". ${campoDe("embargos_declaracao", c, "oQueFaltaDecidir")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 1.022 do Código de Processo Civil, cabem embargos de declaração contra decisão que contenha obscuridade, contradição, omissão ou erro material.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o acolhimento dos presentes embargos, para que o vício apontado seja sanado, com efeitos infringentes se necessário para a correção buscada.",
    },
    fechoPeca(),
  ]);
}

function gerarApelacao(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("apelacao", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte apelante"),
    {
      chave: "das_razoes",
      titulo: "Das Razões do Recurso",
      corpo: campoDe("apelacao", c, "razoesRecurso"),
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido de Reforma",
      corpo: `Requer o conhecimento e provimento do presente recurso, para ${campoDe("apelacao", c, "pedidoReforma")}`,
    },
    fechoPeca(),
  ]);
}

function gerarContrarrazoesApelacao(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("contrarrazoes_apelacao", [
    enderecamentoTribunal(ctx),
    qualificacaoResumida(ctx, "parte apelada"),
    {
      chave: "dos_argumentos_apelante",
      titulo: "Da Síntese do Recurso",
      corpo: `O apelante sustenta, em síntese: ${campoDe("contrarrazoes_apelacao", c, "argumentosApelante")}`,
    },
    {
      chave: "das_contrarrazoes",
      titulo: "Das Contrarrazões",
      corpo: campoDe("contrarrazoes_apelacao", c, "contrarrazoes"),
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o conhecimento e desprovimento do recurso, mantendo-se a sentença recorrida em todos os seus termos.",
    },
    fechoPeca(),
  ]);
}

function gerarCumprimentoSentenca(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("cumprimento_sentenca", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte exequente"),
    {
      chave: "da_obrigacao",
      titulo: "Da Obrigação a Cumprir",
      corpo: `A sentença transitada em julgado determinou: ${campoDe("cumprimento_sentenca", c, "obrigacaoExequenda")}. Valor atualizado devido: ${campoDe("cumprimento_sentenca", c, "valorAtualizado")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cumprimento de Sentença",
      corpo: "Nos termos do art. 523 do Código de Processo Civil, requer-se a intimação da parte executada para pagamento voluntário no prazo de 15 (quinze) dias, sob pena de multa de 10% (dez por cento) e honorários advocatícios de 10% (dez por cento), além do início dos atos de expropriação em caso de inadimplência.",
    },
    fechoPeca(),
  ]);
}

function gerarPedidoMulta(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("pedido_multa", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte exequente/beneficiária"),
    {
      chave: "do_descumprimento",
      titulo: "Do Descumprimento",
      corpo: `A parte executada foi intimada a cumprir a seguinte obrigação: ${campoDe("pedido_multa", c, "obrigacaoDescumprida")}, no prazo de ${campoDe("pedido_multa", c, "prazoConcedido")}, e não o fez até o momento.`,
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido de Aplicação/Majoração da Multa",
      corpo: `Nos termos do art. 537 do Código de Processo Civil, requer-se a aplicação (ou majoração) da multa diária (astreintes) no valor de ${campoDe("pedido_multa", c, "valorMultaSugerido")}, até o efetivo cumprimento da obrigação.`,
    },
    fechoPeca(),
  ]);
}

function gerarHomologacaoAcordo(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("homologacao_acordo", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte"),
    {
      chave: "do_acordo",
      titulo: "Do Acordo Celebrado",
      corpo: `As partes celebraram acordo nos seguintes termos: ${campoDe("homologacao_acordo", c, "termosAcordo")}`,
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido de Homologação",
      corpo: "Requerem as partes a homologação do acordo celebrado, com a consequente extinção do processo com resolução de mérito, nos termos do art. 487, III, \"b\", do Código de Processo Civil.",
    },
    fechoPeca(),
  ]);
}

// ------------------------------------------------------------ Trabalhista (rito da CLT)

function gerarManifestacaoDefesa(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("manifestacao_defesa", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte reclamante"),
    {
      chave: "da_defesa",
      titulo: "Da Síntese da Defesa",
      corpo: `A parte reclamada apresentou defesa, alegando, em síntese: ${campoDe("manifestacao_defesa", c, "pontosDefesa")}`,
    },
    {
      chave: "da_impugnacao",
      titulo: "Da Impugnação",
      corpo: "Nenhum dos argumentos da defesa é capaz de afastar o direito da parte reclamante, pelos fundamentos já expostos na petição inicial, que aqui se reiteram e passam a integrar esta manifestação.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o prosseguimento do feito, com a improcedência das teses defensivas e a procedência dos pedidos formulados na petição inicial.",
    },
    fechoPeca(),
  ]);
}

function gerarRecursoOrdinario(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("recurso_ordinario", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte recorrente"),
    {
      chave: "das_razoes",
      titulo: "Das Razões do Recurso",
      corpo: campoDe("recurso_ordinario", c, "razoesRecurso"),
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "O presente recurso ordinário é cabível nos termos do art. 895, I, da CLT, contra a sentença proferida pela Vara do Trabalho.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido de Reforma",
      corpo: `Requer o conhecimento e provimento do presente recurso, para ${campoDe("recurso_ordinario", c, "pedidoReforma")}`,
    },
    fechoPeca(),
  ]);
}

function gerarContrarrazoesRecursoOrdinario(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("contrarrazoes_recurso_ordinario", [
    enderecamentoTribunal(ctx),
    qualificacaoResumida(ctx, "parte recorrida"),
    {
      chave: "dos_argumentos_recorrente",
      titulo: "Da Síntese do Recurso",
      corpo: `O recorrente sustenta, em síntese: ${campoDe("contrarrazoes_recurso_ordinario", c, "argumentosRecorrente")}`,
    },
    {
      chave: "das_contrarrazoes",
      titulo: "Das Contrarrazões",
      corpo: campoDe("contrarrazoes_recurso_ordinario", c, "contrarrazoes"),
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o conhecimento e desprovimento do recurso, mantendo-se a sentença recorrida em todos os seus termos.",
    },
    fechoPeca(),
  ]);
}

function gerarCumprimentoExecucaoTrabalhista(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("cumprimento_execucao_trabalhista", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte exequente"),
    {
      chave: "da_obrigacao",
      titulo: "Das Verbas Devidas",
      corpo: `A sentença/acordo transitado em julgado determinou: ${campoDe("cumprimento_execucao_trabalhista", c, "obrigacaoExequenda")}. Valor apurado na planilha de cálculos anexa: ${campoDe("cumprimento_execucao_trabalhista", c, "valorCalculado")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Da Execução",
      corpo: "Nos termos dos arts. 876 e 880 da CLT, requer-se a citação da parte executada para pagamento no prazo legal, sob pena de penhora de bens suficientes para a garantia do juízo.",
    },
    fechoPeca(),
  ]);
}

function gerarImpugnacaoCalculos(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("impugnacao_calculos", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte"),
    {
      chave: "dos_calculos_impugnados",
      titulo: "Dos Cálculos Impugnados",
      corpo: `Os cálculos apresentados contêm o seguinte erro: ${campoDe("impugnacao_calculos", c, "calculosImpugnados")}`,
    },
    {
      chave: "do_criterio_correto",
      titulo: "Do Critério Correto",
      corpo: campoDe("impugnacao_calculos", c, "criterioCorreto"),
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 884 da CLT, cabe à parte impugnar os cálculos de liquidação no prazo legal, sob pena de preclusão.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o acolhimento da presente impugnação, com a retificação dos cálculos na forma aqui exposta.",
    },
    fechoPeca(),
  ]);
}

function gerarAgravoPeticao(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("agravo_peticao", [
    enderecamentoTribunal(ctx),
    qualificacaoResumida(ctx, "parte agravante"),
    {
      chave: "da_decisao_agravada",
      titulo: "Da Decisão Agravada",
      corpo: `A decisão agravada, proferida na fase de execução, decidiu: ${campoDe("agravo_peticao", c, "decisaoAgravada")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "O presente agravo de petição é cabível nos termos do art. 897, \"a\", da CLT, contra decisões proferidas na execução trabalhista.",
    },
    {
      chave: "do_fundamento",
      titulo: "Da Reforma da Decisão",
      corpo: campoDe("agravo_peticao", c, "fundamentoReforma"),
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o conhecimento e provimento do presente agravo, para reformar a decisão agravada na forma aqui exposta.",
    },
    fechoPeca(),
  ]);
}

// ------------------------------------------------------------ Família (execução de alimentos)

function gerarCumprimentoAlimentos(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("cumprimento_alimentos", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte exequente/alimentando(a)"),
    {
      chave: "do_debito",
      titulo: "Do Débito Alimentar",
      corpo: `Encontram-se em aberto as seguintes parcelas de alimentos: ${campoDe("cumprimento_alimentos", c, "periodoDebito")}, totalizando o valor de ${campoDe("cumprimento_alimentos", c, "valorDevido")}.`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 528 do Código de Processo Civil, requer-se a intimação do executado para, em 3 (três) dias, pagar o débito, provar que o fez ou justificar a impossibilidade de fazê-lo, sob pena de protesto do pronunciamento judicial e, não havendo justificativa idônea, decretação de prisão civil pelo prazo de 1 (um) a 3 (três) meses.",
    },
    fechoPeca(),
  ]);
}

function gerarPedidoPrisaoCivil(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("pedido_prisao_civil", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte exequente/alimentando(a)"),
    {
      chave: "da_inadimplencia",
      titulo: "Da Inadimplência Persistente",
      corpo: `Intimado nos termos do art. 528 do CPC, o executado não efetuou o pagamento. Permanecem em aberto: ${campoDe("pedido_prisao_civil", c, "parcelasInadimplidas")}. Quanto à justificativa apresentada: ${campoDe("pedido_prisao_civil", c, "justificativaApresentada")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 528, §§3º a 7º, do Código de Processo Civil, não paga a dívida, não comprovado o pagamento e não apresentada justificativa que comporte deferimento, cabe a decretação da prisão civil do executado, pelo prazo de 1 (um) a 3 (três) meses.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer a decretação da prisão civil do executado, até o limite de 3 (três) meses, ou até que comprove o pagamento integral do débito.",
    },
    fechoPeca(),
  ]);
}

function gerarJustificativaImpossibilidadePagamento(
  ctx: ContextoPeca,
  c: ValoresCamposPeca,
): PetitionDocument {
  return documento("justificativa_impossibilidade_pagamento", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte executada"),
    {
      chave: "do_motivo",
      titulo: "Do Motivo da Impossibilidade",
      corpo: `A parte executada não efetuou o pagamento integral do débito alimentar pelo seguinte motivo: ${campoDe("justificativa_impossibilidade_pagamento", c, "motivoImpossibilidade")}. Em comprovação, junta: ${campoDe("justificativa_impossibilidade_pagamento", c, "provasAnexadas")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 528, §2º, do Código de Processo Civil, somente a impossibilidade absoluta de pagar justifica o não pagamento, cabendo à parte executada o ônus de comprovar tal circunstância.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o acolhimento da presente justificativa, com o consequente afastamento da decretação de prisão civil.",
    },
    fechoPeca(),
  ]);
}

// ------------------------------------------------------------ Previdenciário (Justiça Federal)

function gerarRecursoInominado(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("recurso_inominado", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte recorrente"),
    {
      chave: "das_razoes",
      titulo: "Das Razões do Recurso",
      corpo: campoDe("recurso_inominado", c, "razoesRecurso"),
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "O presente recurso inominado é cabível nos termos do art. 41 da Lei nº 9.099/1995 e do art. 1º da Lei nº 10.259/2001, contra a sentença proferida pelo Juizado Especial Federal.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido de Reforma",
      corpo: `Requer o conhecimento e provimento do presente recurso, para ${campoDe("recurso_inominado", c, "pedidoReforma")}`,
    },
    fechoPeca(),
  ]);
}

function gerarContrarrazoesRecursoInominado(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("contrarrazoes_recurso_inominado", [
    enderecamentoTurmaRecursal(ctx),
    qualificacaoResumida(ctx, "parte recorrida"),
    {
      chave: "dos_argumentos_recorrente",
      titulo: "Da Síntese do Recurso",
      corpo: `O recorrente sustenta, em síntese: ${campoDe("contrarrazoes_recurso_inominado", c, "argumentosRecorrente")}`,
    },
    {
      chave: "das_contrarrazoes",
      titulo: "Das Contrarrazões",
      corpo: campoDe("contrarrazoes_recurso_inominado", c, "contrarrazoes"),
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o conhecimento e desprovimento do recurso, mantendo-se a sentença recorrida em todos os seus termos.",
    },
    fechoPeca(),
  ]);
}

function gerarCumprimentoFazendaPublica(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("cumprimento_fazenda_publica", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte exequente"),
    {
      chave: "dos_valores_atrasados",
      titulo: "Dos Valores Atrasados",
      corpo: `Encontram-se em aberto os valores atrasados referentes ao período de ${campoDe("cumprimento_fazenda_publica", c, "periodoAtrasados")}, apurados em ${campoDe("cumprimento_fazenda_publica", c, "valorApurado")}.`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 535 do Código de Processo Civil e do art. 17 da Lei nº 10.259/2001, por se tratar de execução contra a Fazenda Pública, requer-se a intimação do INSS para impugnar no prazo de 30 (trinta) dias e, não havendo impugnação ou após seu julgamento, a expedição de Requisição de Pequeno Valor (RPV) — ou, caso o valor supere 60 (sessenta) salários mínimos, de precatório — para pagamento dos valores atrasados.",
    },
    fechoPeca(),
  ]);
}

function gerarImplantacaoBeneficio(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("implantacao_beneficio", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte autora/beneficiária"),
    {
      chave: "do_beneficio",
      titulo: "Do Benefício Concedido",
      corpo: `A sentença concedeu o seguinte benefício: ${campoDe("implantacao_beneficio", c, "beneficioConcedido")}, com data de início (DIB) em ${campoDe("implantacao_beneficio", c, "dataInicioBeneficio")}, e até o momento o INSS não o implantou.`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos dos arts. 497 e 536 do Código de Processo Civil, a obrigação de implantar o benefício é obrigação de fazer, exigível independentemente do trânsito em julgado quanto aos valores atrasados. Requer-se a intimação do INSS para implantar o benefício no prazo de 30 (trinta) dias, sob pena de multa diária a ser arbitrada por este Juízo.",
    },
    fechoPeca(),
  ]);
}

// ------------------------------------------------------------ Cível (genérico)

function gerarImpugnacaoContestacao(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("impugnacao_contestacao", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte autora"),
    {
      chave: "da_preliminar",
      titulo: "Das Preliminares e Documentos Novos",
      corpo: `A contestação trouxe preliminar e/ou documento novo, nos seguintes termos: ${campoDe("impugnacao_contestacao", c, "preliminaresDocumentos")}`,
    },
    {
      chave: "da_resposta",
      titulo: "Da Resposta",
      corpo: campoDe("impugnacao_contestacao", c, "resposta"),
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 350 do Código de Processo Civil, aberto prazo para manifestação sobre preliminar ou documento novo juntado na contestação, apresenta-se a presente impugnação.",
    },
    fechoPeca(),
  ]);
}

function gerarReconvencao(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("reconvencao", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte ré-reconvinte"),
    {
      chave: "dos_fatos",
      titulo: "Dos Fatos",
      corpo: campoDe("reconvencao", c, "fatosReconvencao"),
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 343 do Código de Processo Civil, a parte ré, na própria contestação ou em peça autônoma no mesmo prazo, pode formular pedido contra a parte autora, desde que conexo com a ação principal ou com a defesa.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: `Requer o processamento da presente reconvenção, conjuntamente com a ação principal, para ${campoDe("reconvencao", c, "pedidoReconvencao")}`,
    },
    fechoPeca(),
  ]);
}

function gerarAgravoInstrumento(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("agravo_instrumento", [
    enderecamentoTribunal(ctx),
    qualificacaoResumida(ctx, "parte agravante"),
    {
      chave: "da_decisao_agravada",
      titulo: "Da Decisão Agravada",
      corpo: `A decisão agravada decidiu: ${campoDe("agravo_instrumento", c, "decisaoAgravada")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: `O presente recurso é cabível nos termos do art. 1.015 do Código de Processo Civil, por se tratar de decisão interlocutória que versa sobre: ${campoDe("agravo_instrumento", c, "hipoteseCabimento")}`,
    },
    {
      chave: "do_fundamento",
      titulo: "Da Reforma da Decisão",
      corpo: campoDe("agravo_instrumento", c, "fundamentoReforma"),
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o conhecimento e provimento do presente agravo, para reformar a decisão agravada na forma aqui exposta.",
    },
    fechoPeca(),
  ]);
}

function gerarContrarrazoesAgravoInstrumento(
  ctx: ContextoPeca,
  c: ValoresCamposPeca,
): PetitionDocument {
  return documento("contrarrazoes_agravo_instrumento", [
    enderecamentoTribunal(ctx),
    qualificacaoResumida(ctx, "parte agravada"),
    {
      chave: "dos_argumentos_agravante",
      titulo: "Da Síntese do Recurso",
      corpo: `O agravante sustenta, em síntese: ${campoDe("contrarrazoes_agravo_instrumento", c, "argumentosAgravante")}`,
    },
    {
      chave: "das_contrarrazoes",
      titulo: "Das Contrarrazões",
      corpo: campoDe("contrarrazoes_agravo_instrumento", c, "contrarrazoes"),
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o conhecimento e desprovimento do presente agravo, mantendo-se a decisão agravada em todos os seus termos.",
    },
    fechoPeca(),
  ]);
}

function gerarImpugnacaoCumprimento(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("impugnacao_cumprimento", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte executada"),
    {
      chave: "da_materia",
      titulo: "Da Matéria Alegada",
      corpo: `A parte executada impugna o cumprimento de sentença pela seguinte matéria: ${campoDe("impugnacao_cumprimento", c, "materiaImpugnada")}. Valor que entende correto, se o caso: ${campoDe("impugnacao_cumprimento", c, "valorCorreto")}`,
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 525 do Código de Processo Civil, no prazo de 15 (quinze) dias contado do término do prazo para pagamento voluntário, independentemente de garantia do juízo, a parte executada pode impugnar o cumprimento de sentença.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o acolhimento da presente impugnação, com a extinção ou redução da execução na forma aqui exposta.",
    },
    fechoPeca(),
  ]);
}

function gerarEmbargosExecucao(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("embargos_execucao", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte executada/embargante"),
    {
      chave: "do_titulo",
      titulo: "Do Título Executado",
      corpo: `A presente execução tem por base o seguinte título extrajudicial: ${campoDe("embargos_execucao", c, "tituloExecutado")}`,
    },
    {
      chave: "da_materia",
      titulo: "Da Matéria de Defesa",
      corpo: campoDe("embargos_execucao", c, "materiaEmbargos"),
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "Nos termos do art. 914 do Código de Processo Civil, independentemente de garantia do juízo, o executado pode se opor à execução por meio de embargos, no prazo de 15 (quinze) dias.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o acolhimento dos presentes embargos, com a extinção ou redução da execução na forma aqui exposta.",
    },
    fechoPeca(),
  ]);
}

function gerarExcecaoPreExecutividade(ctx: ContextoPeca, c: ValoresCamposPeca): PetitionDocument {
  return documento("excecao_pre_executividade", [
    enderecamentoJuizo(ctx),
    qualificacaoResumida(ctx, "parte executada"),
    {
      chave: "da_materia",
      titulo: "Da Matéria de Ordem Pública",
      corpo: campoDe("excecao_pre_executividade", c, "materiaOrdemPublica"),
    },
    {
      chave: "do_cabimento",
      titulo: "Do Cabimento",
      corpo: "A exceção de pré-executividade é cabível independentemente de penhora ou de qualquer garantia do juízo, restrita a matérias de ordem pública cognoscíveis de ofício ou a questões que possam ser comprovadas de plano, sem necessidade de dilação probatória, conforme entendimento consolidado do Superior Tribunal de Justiça.",
    },
    {
      chave: "do_pedido",
      titulo: "Do Pedido",
      corpo: "Requer o acolhimento da presente exceção, com a extinção da execução ou o reconhecimento da matéria arguida.",
    },
    fechoPeca(),
  ]);
}

const GERADORES: Record<TipoPeca, (ctx: ContextoPeca, c: ValoresCamposPeca) => PetitionDocument> = {
  replica: gerarReplica,
  agravo_tutela: gerarAgravoTutela,
  embargos_declaracao: gerarEmbargosDeclaracao,
  apelacao: gerarApelacao,
  contrarrazoes_apelacao: gerarContrarrazoesApelacao,
  cumprimento_sentenca: gerarCumprimentoSentenca,
  pedido_multa: gerarPedidoMulta,
  homologacao_acordo: gerarHomologacaoAcordo,
  manifestacao_defesa: gerarManifestacaoDefesa,
  recurso_ordinario: gerarRecursoOrdinario,
  contrarrazoes_recurso_ordinario: gerarContrarrazoesRecursoOrdinario,
  cumprimento_execucao_trabalhista: gerarCumprimentoExecucaoTrabalhista,
  impugnacao_calculos: gerarImpugnacaoCalculos,
  agravo_peticao: gerarAgravoPeticao,
  cumprimento_alimentos: gerarCumprimentoAlimentos,
  pedido_prisao_civil: gerarPedidoPrisaoCivil,
  justificativa_impossibilidade_pagamento: gerarJustificativaImpossibilidadePagamento,
  recurso_inominado: gerarRecursoInominado,
  contrarrazoes_recurso_inominado: gerarContrarrazoesRecursoInominado,
  cumprimento_fazenda_publica: gerarCumprimentoFazendaPublica,
  implantacao_beneficio: gerarImplantacaoBeneficio,
  impugnacao_contestacao: gerarImpugnacaoContestacao,
  reconvencao: gerarReconvencao,
  agravo_instrumento: gerarAgravoInstrumento,
  contrarrazoes_agravo_instrumento: gerarContrarrazoesAgravoInstrumento,
  impugnacao_cumprimento: gerarImpugnacaoCumprimento,
  embargos_execucao: gerarEmbargosExecucao,
  excecao_pre_executividade: gerarExcecaoPreExecutividade,
};

export function gerarPeca(
  tipo: TipoPeca,
  ctx: ContextoPeca,
  valores: ValoresCamposPeca,
): PetitionDocument {
  return GERADORES[tipo](ctx, valores);
}
