import type { Applicant } from "@/domain/case/schema";
import type { LegalAreaSlug } from "@/domain/legal-area/schema";
import { campo, type PetitionSection } from "@/domain/petition/schema";

/** Contexto comum a qualquer peça pós-decisão: dados já conhecidos do caso, nunca pedidos de
 * novo ao advogado. `areaSlug` decide o endereçamento certo — Vara do Trabalho/TRT para
 * trabalhista, Vara Federal/TRF para previdenciário (o INSS é Fazenda Pública, Justiça Federal),
 * Vara/Comarca/TJ para as demais. */
export type ContextoPeca = {
  applicant: Pick<Applicant, "fullName" | "city" | "uf">;
  protocolo: string;
  numeroProcesso?: string;
  areaSlug: LegalAreaSlug;
};

/** Juízo de 1ª instância — réplica, embargos (contra sentença), cumprimento de sentença, pedido
 * de multa, homologação de acordo, recurso inominado (protocolado no próprio juízo a quo)
 * continuam no mesmo juízo que já processa a causa. */
export function enderecamentoJuizo(ctx: ContextoPeca): PetitionSection {
  const cidade = campo(ctx.applicant.city, "cidade da comarca/seção judiciária");
  const uf = campo(ctx.applicant.uf, "UF da comarca/seção judiciária");
  let corpo: string;
  if (ctx.areaSlug === "trabalhista") {
    corpo = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DO TRABALHO DA VARA DO TRABALHO DE ${cidade}/${uf}`;
  } else if (ctx.areaSlug === "previdenciario") {
    corpo = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) FEDERAL DA VARA FEDERAL/JUIZADO ESPECIAL FEDERAL DE ${cidade}/${uf}`;
  } else {
    corpo = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA VARA COMPETENTE DA COMARCA DE ${cidade}/${uf}`;
  }
  return {
    chave: "enderecamento",
    titulo: "Endereçamento",
    corpo: `${corpo}\n\nProcesso nº ${campo(ctx.numeroProcesso, "número do processo")}`,
  };
}

/** Tribunal — agravo de instrumento, apelação e as contrarrazões correspondentes sobem de
 * instância (TRT para trabalhista, TRF para previdenciário, TJ para as demais). Recurso
 * inominado (JEF) tem seu próprio endereçamento — ver enderecamentoTurmaRecursal. */
export function enderecamentoTribunal(ctx: ContextoPeca): PetitionSection {
  const uf = campo(ctx.applicant.uf, "UF do tribunal");
  let corpo: string;
  if (ctx.areaSlug === "trabalhista") {
    corpo = `EGRÉGIO TRIBUNAL REGIONAL DO TRABALHO DA REGIÃO COMPETENTE PARA ${uf}`;
  } else if (ctx.areaSlug === "previdenciario") {
    corpo = `EGRÉGIO TRIBUNAL REGIONAL FEDERAL DA REGIÃO COMPETENTE PARA ${uf}`;
  } else {
    corpo = `EGRÉGIO TRIBUNAL DE JUSTIÇA DO ESTADO DE ${uf}`;
  }
  return {
    chave: "enderecamento",
    titulo: "Endereçamento",
    corpo: `${corpo}\n\nProcesso de origem nº ${campo(ctx.numeroProcesso, "número do processo de origem")}`,
  };
}

/** Turma Recursal dos Juizados Especiais Federais — só para contrarrazões de recurso inominado
 * (previdenciário/JEF); não tem equivalente nas demais áreas, por isso não entra no branch de
 * enderecamentoTribunal acima. */
export function enderecamentoTurmaRecursal(ctx: ContextoPeca): PetitionSection {
  const uf = campo(ctx.applicant.uf, "UF da seção judiciária");
  return {
    chave: "enderecamento",
    titulo: "Endereçamento",
    corpo:
      `EGRÉGIA TURMA RECURSAL DOS JUIZADOS ESPECIAIS FEDERAIS DA SEÇÃO JUDICIÁRIA DE ${uf}\n\n` +
      `Processo de origem nº ${campo(ctx.numeroProcesso, "número do processo de origem")}`,
  };
}

export function qualificacaoResumida(ctx: ContextoPeca, papel: string): PetitionSection {
  return {
    chave: "qualificacao",
    titulo: "Qualificação",
    corpo: `${campo(ctx.applicant.fullName, "nome completo da parte")}, já qualificado(a) nos autos do processo em epígrafe, por seu(sua) advogado(a) que esta subscreve, vem respeitosamente perante Vossa Excelência, na qualidade de ${papel}, expor e requerer o quanto segue:`,
  };
}

export function fechoPeca(): PetitionSection {
  return {
    chave: "fecho",
    titulo: "Termos em que",
    corpo: "Nestes termos, pede deferimento.\n\n[local], [data].\n\n[PENDENTE: nome e OAB do(a) advogado(a)]",
  };
}
