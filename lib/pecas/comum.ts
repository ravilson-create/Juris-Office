import type { Applicant } from "@/domain/case/schema";
import { campo, type PetitionSection } from "@/domain/petition/schema";

/** Contexto comum a qualquer peça pós-decisão: dados já conhecidos do caso, nunca pedidos de
 * novo ao advogado. */
export type ContextoPeca = {
  applicant: Pick<Applicant, "fullName" | "city" | "uf">;
  protocolo: string;
  numeroProcesso?: string;
};

/** Juízo de 1ª instância — réplica, embargos (contra sentença), cumprimento de sentença, pedido
 * de multa, homologação de acordo continuam no mesmo juízo que já processa a causa. */
export function enderecamentoJuizo(ctx: ContextoPeca): PetitionSection {
  return {
    chave: "enderecamento",
    titulo: "Endereçamento",
    corpo:
      `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA VARA COMPETENTE DA COMARCA DE ` +
      `${campo(ctx.applicant.city, "cidade da comarca")}/${campo(ctx.applicant.uf, "UF da comarca")}\n\n` +
      `Processo nº ${campo(ctx.numeroProcesso, "número do processo")}`,
  };
}

/** Tribunal — agravo de instrumento, apelação e as contrarrazões correspondentes sobem de
 * instância. */
export function enderecamentoTribunal(ctx: ContextoPeca): PetitionSection {
  return {
    chave: "enderecamento",
    titulo: "Endereçamento",
    corpo:
      `EGRÉGIO TRIBUNAL DE JUSTIÇA DO ESTADO DE ${campo(ctx.applicant.uf, "UF do tribunal")}\n\n` +
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
