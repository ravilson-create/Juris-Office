import { campo, type PetitionDocument } from "@/domain/petition/schema";
import { CAMPOS_PECA, TITULO_PECA, type TipoPeca } from "@/domain/pecas/schema";
import {
  enderecamentoJuizo,
  enderecamentoTribunal,
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

const GERADORES: Record<TipoPeca, (ctx: ContextoPeca, c: ValoresCamposPeca) => PetitionDocument> = {
  replica: gerarReplica,
  agravo_tutela: gerarAgravoTutela,
  embargos_declaracao: gerarEmbargosDeclaracao,
  apelacao: gerarApelacao,
  contrarrazoes_apelacao: gerarContrarrazoesApelacao,
  cumprimento_sentenca: gerarCumprimentoSentenca,
  pedido_multa: gerarPedidoMulta,
  homologacao_acordo: gerarHomologacaoAcordo,
};

export function gerarPeca(
  tipo: TipoPeca,
  ctx: ContextoPeca,
  valores: ValoresCamposPeca,
): PetitionDocument {
  return GERADORES[tipo](ctx, valores);
}
