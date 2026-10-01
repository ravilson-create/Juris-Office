import type { AnswerMap } from "@/domain/triage/engine";
import type { Applicant } from "@/domain/case/schema";
import { campo, type PetitionSection } from "@/domain/petition/schema";

export function textoAnswer(answers: AnswerMap, key: string): string | undefined {
  const v = answers[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function numeroAnswer(answers: AnswerMap, key: string): number | undefined {
  const v = answers[key];
  return typeof v === "number" ? v : undefined;
}

export function booleanAnswer(answers: AnswerMap, key: string): boolean {
  return answers[key] === true;
}

/**
 * Endereçamento e qualificação do autor — comuns a toda petição cível/família gerada pelo
 * sistema. A qualificação completa (CPF, RG, estado civil, profissão, endereço) não é coletada
 * no atendimento (minimização de dados da fase de triagem) — fica pendente para o advogado
 * completar antes de protocolar, nunca inventada.
 */
export function secoesCabecalho(params: {
  varaLabel: string;
  applicant: Pick<Applicant, "fullName" | "city" | "uf">;
}): PetitionSection[] {
  const { varaLabel, applicant } = params;
  return [
    {
      chave: "enderecamento",
      titulo: "Endereçamento",
      corpo: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ${varaLabel} DA COMARCA DE ${campo(applicant.city, "cidade da comarca")}/${campo(applicant.uf, "UF da comarca")}`,
    },
    {
      chave: "qualificacao_autor",
      titulo: "Qualificação do(a) Autor(a)",
      corpo: `${campo(applicant.fullName, "nome completo do(a) autor(a)")}, ${campo(undefined, "nacionalidade")}, ${campo(undefined, "estado civil")}, ${campo(undefined, "profissão")}, portador(a) do CPF nº ${campo(undefined, "CPF do(a) autor(a)")} e do RG nº ${campo(undefined, "RG do(a) autor(a)")}, residente e domiciliado(a) em ${campo(undefined, "endereço completo do(a) autor(a)")}, ${campo(applicant.city, "cidade")}/${campo(applicant.uf, "UF")}, por seu(sua) advogado(a) que esta subscreve (procuração anexa), vem respeitosamente perante Vossa Excelência propor a presente`,
    },
  ];
}

export const SECAO_PROVAS: PetitionSection = {
  chave: "das_provas",
  titulo: "Das Provas",
  corpo: "Protesta provar o alegado por todos os meios de prova em direito admitidos, sem exceção, notadamente por documentos, depoimento pessoal da parte contrária, oitiva de testemunhas e, se necessário, prova pericial.",
};

export const SECAO_FECHO: PetitionSection = {
  chave: "fecho",
  titulo: "Termos em que",
  corpo: "Nestes termos, pede deferimento.\n\n[local], [data].\n\n[PENDENTE: nome e OAB do(a) advogado(a)]",
};

export function secaoValorCausa(valor: string): PetitionSection {
  return {
    chave: "valor_causa",
    titulo: "Do Valor da Causa",
    corpo: `Dá-se à causa o valor de ${valor}, nos termos do art. 292 do Código de Processo Civil.`,
  };
}
