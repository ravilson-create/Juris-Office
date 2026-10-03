import type { ContractContent, FeeType } from "@/domain/contract/schema";
import { formatCents } from "@/domain/triage/money";

export type ClausulaContrato = { chave: string; titulo: string; corpo: string };

function formatCpf(digitos: string): string {
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos) — o CPF/CNPJ do escritório aceita os dois. */
function formatCpfCnpj(digitos: string): string {
  if (digitos.length === 11) return formatCpf(digitos);
  return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
}

function descricaoHonorario(feeType: FeeType, feeValueCents: number, successPercentage: number | null): string {
  const valor = formatCents(feeValueCents);
  switch (feeType) {
    case "fixed":
      return `honorários no valor fixo de ${valor}, pela integralidade dos serviços descritos na cláusula 2ª (Do Objeto)`;
    case "success":
      return `honorários de êxito correspondentes a ${successPercentage ?? 0}% (por cento) sobre o proveito econômico efetivamente obtido pelo CONTRATANTE ao final da causa`;
    case "hourly":
      return `honorários calculados por hora trabalhada, ao valor de referência de ${valor} por hora, apurados e cobrados conforme o avanço dos trabalhos`;
    case "mixed":
      return `honorários mistos: uma parcela fixa de ${valor}, somada a ${successPercentage ?? 0}% (por cento) de honorários de êxito sobre o proveito econômico efetivamente obtido pelo CONTRATANTE ao final da causa`;
  }
}

/**
 * Gera as cláusulas de um contrato de prestação de serviços advocatícios comum (qualificação das
 * partes, objeto, honorários, forma de pagamento, obrigações recíprocas, prazo, rescisão,
 * confidencialidade/LGPD e foro), a partir do retrato gravado em `contracts.content` no momento
 * da criação. Texto fixo e previsível de propósito — não é gerado por IA — para que o mesmo
 * contrato possa ser auditado clausula a clausula a qualquer momento.
 */
export function gerarClausulasContrato(params: {
  content: ContractContent;
  feeType: FeeType;
  feeValueCents: number;
  successPercentage: number | null;
}): ClausulaContrato[] {
  const { content: c, feeType, feeValueCents, successPercentage } = params;
  return [
    {
      chave: "das_partes",
      titulo: "1ª — Das Partes",
      corpo:
        `CONTRATADO: ${c.lawyerFullName}, inscrito(a) na OAB/${c.oabUf} sob o nº ${c.oabNumero}, ` +
        `CPF nº ${formatCpf(c.lawyerCpf)}, atuando pelo escritório ${c.officeName}, inscrito no ` +
        `CPF/CNPJ sob o nº ${formatCpfCnpj(c.officeCpfCnpj)}, com endereço profissional em ${c.officeAddress}.\n\n` +
        `CONTRATANTE: ${c.clientFullName}, CPF nº ${formatCpf(c.clientCpf)}, residente e domiciliado(a) em ${c.clientAddress}.\n\n` +
        `As partes acima qualificadas firmam o presente Contrato de Prestação de Serviços Advocatícios, ` +
        `que se regerá pelas cláusulas seguintes e pela legislação aplicável, em especial a Lei nº 8.906/1994 ` +
        `(Estatuto da Advocacia e da OAB) e o Código de Ética e Disciplina da OAB.`,
    },
    {
      chave: "do_objeto",
      titulo: "2ª — Do Objeto",
      corpo: `O presente contrato tem por objeto a prestação, pelo CONTRATADO, dos seguintes serviços advocatícios ao CONTRATANTE: ${c.object}`,
    },
    {
      chave: "dos_honorarios",
      titulo: "3ª — Dos Honorários Advocatícios",
      corpo:
        `Pelos serviços objeto deste contrato, o CONTRATANTE pagará ao CONTRATADO ${descricaoHonorario(feeType, feeValueCents, successPercentage)}. ` +
        `Os honorários ora pactuados não incluem custas processuais, taxas, emolumentos e demais despesas ` +
        `necessárias ao andamento da causa, que correm por conta do CONTRATANTE, nem os honorários de ` +
        `sucumbência eventualmente arbitrados pelo juízo em favor do CONTRATADO, que lhe pertencem ` +
        `integralmente nos termos do art. 23 da Lei nº 8.906/1994.`,
    },
    {
      chave: "da_forma_de_pagamento",
      titulo: "4ª — Da Forma de Pagamento",
      corpo:
        `O pagamento dos honorários observará o cronograma de parcelas registrado neste sistema, ` +
        `vinculado a este contrato. O atraso no pagamento de qualquer parcela sujeita o valor devido à ` +
        `atualização monetária e aos encargos legais, sem prejuízo da faculdade de rescisão prevista na cláusula 7ª.`,
    },
    {
      chave: "obrigacoes_contratado",
      titulo: "5ª — Das Obrigações do CONTRATADO",
      corpo:
        `O CONTRATADO obriga-se a: (i) empregar a diligência e a técnica profissional devidas na defesa ` +
        `dos interesses do CONTRATANTE, sem garantir resultado, dada a natureza aleatória da atividade ` +
        `jurisdicional; (ii) manter sigilo profissional sobre fatos e documentos de que tiver conhecimento ` +
        `em razão deste contrato, nos termos do art. 34, VII, da Lei nº 8.906/1994; (iii) informar o ` +
        `CONTRATANTE sobre o andamento relevante da causa; (iv) prestar contas de valores recebidos em ` +
        `nome do CONTRATANTE, quando houver.`,
    },
    {
      chave: "obrigacoes_contratante",
      titulo: "6ª — Das Obrigações do CONTRATANTE",
      corpo:
        `O CONTRATANTE obriga-se a: (i) fornecer, com veracidade e tempestividade, as informações e os ` +
        `documentos necessários à prestação dos serviços; (ii) pagar os honorários e ressarcir as despesas ` +
        `nos prazos acordados; (iii) comunicar ao CONTRATADO qualquer mudança de endereço, telefone ou ` +
        `e-mail; (iv) não transigir, desistir ou praticar qualquer ato relativo à causa sem prévia ciência do CONTRATADO.`,
    },
    {
      chave: "do_prazo",
      titulo: "7ª — Do Prazo e da Vigência",
      corpo:
        `Este contrato vigora pelo tempo necessário ao cumprimento integral do objeto descrito na ` +
        `cláusula 2ª, incluindo eventuais recursos cabíveis na mesma instância em que os serviços forem ` +
        `prestados. Serviços adicionais, novas fases ou novos recursos de instância superior dependem de ` +
        `aditivo ou de novo contrato.`,
    },
    {
      chave: "da_rescisao",
      titulo: "8ª — Da Rescisão",
      corpo:
        `Este contrato poderá ser rescindido a qualquer tempo, por renúncia do CONTRATADO ou revogação do ` +
        `mandato pelo CONTRATANTE, observadas as formalidades dos arts. 44 a 46 do Código de Ética e ` +
        `Disciplina da OAB. Em caso de rescisão antes da conclusão dos serviços, são devidos ao CONTRATADO ` +
        `os honorários proporcionais aos serviços já prestados até a data da rescisão, calculados com base ` +
        `na cláusula 3ª.`,
    },
    {
      chave: "da_confidencialidade",
      titulo: "9ª — Da Confidencialidade e da Proteção de Dados Pessoais",
      corpo:
        `Os dados pessoais do CONTRATANTE tratados em razão deste contrato serão usados exclusivamente ` +
        `para a prestação dos serviços aqui descritos, nos termos da Lei nº 13.709/2018 (Lei Geral de ` +
        `Proteção de Dados Pessoais), observado ainda o sigilo profissional do advogado previsto no art. ` +
        `34, VII, da Lei nº 8.906/1994.`,
    },
    {
      chave: "do_foro",
      titulo: "10ª — Do Foro",
      corpo: `Fica eleito o foro da comarca de ${c.forumCity}/${c.forumUf} para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.`,
    },
  ];
}
