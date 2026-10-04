import { z } from "zod";
import type { LegalAreaSlug } from "@/domain/legal-area/schema";

/**
 * As 8 peças pós-decisão mais comuns numa causa (ver conversa com o Ravilson) — tudo que
 * acontece DEPOIS da petição inicial, disparado por uma decisão do juízo ou por ato da parte
 * contrária. Diferente da petição inicial (gerada só da triagem, sem texto livre do advogado),
 * aqui o fato que origina a peça não existe em nenhuma tabela do sistema — por isso cada tipo
 * tem seu próprio formulário de campos livres (ver CAMPOS_PECA), preenchidos pelo advogado no
 * momento de gerar.
 */
export const tipoPecaSchema = z.enum([
  "replica",
  "agravo_tutela",
  "embargos_declaracao",
  "apelacao",
  "contrarrazoes_apelacao",
  "cumprimento_sentenca",
  "pedido_multa",
  "homologacao_acordo",
  // Trabalhista: embargos_declaracao acima já serve (peça genérica, mesmo nome e mesmo CPC
  // subsidiário em qualquer área) — as 6 abaixo são específicas do rito da CLT, sem
  // equivalente de nome nas de cima.
  "manifestacao_defesa",
  "recurso_ordinario",
  "contrarrazoes_recurso_ordinario",
  "cumprimento_execucao_trabalhista",
  "impugnacao_calculos",
  "agravo_peticao",
]);
export type TipoPeca = z.infer<typeof tipoPecaSchema>;

export const TITULO_PECA: Record<TipoPeca, string> = {
  replica: "Réplica à Contestação",
  agravo_tutela: "Agravo de Instrumento contra Indeferimento de Tutela de Urgência",
  embargos_declaracao: "Embargos de Declaração",
  apelacao: "Apelação",
  contrarrazoes_apelacao: "Contrarrazões de Apelação",
  cumprimento_sentenca: "Cumprimento de Sentença",
  pedido_multa: "Pedido de Aplicação/Majoração de Multa (Astreintes)",
  homologacao_acordo: "Petição de Homologação de Acordo",
  manifestacao_defesa: "Manifestação sobre a Defesa e Documentos",
  recurso_ordinario: "Recurso Ordinário",
  contrarrazoes_recurso_ordinario: "Contrarrazões ao Recurso Ordinário",
  cumprimento_execucao_trabalhista: "Execução de Sentença Trabalhista (Cumprimento + Cálculos)",
  impugnacao_calculos: "Impugnação à Sentença de Liquidação / aos Cálculos",
  agravo_peticao: "Agravo de Petição",
};

export type CampoPeca = { chave: string; rotulo: string; placeholder?: string };

/** Campos de texto livre que só o advogado sabe (o que a decisão disse, o que a contestação
 * alegou) — nunca inventados pelo gerador nem pela IA (a correção por IA só reescreve a forma
 * do que entrar aqui, ver lib/ai/corrigir-peticao.ts). */
export const CAMPOS_PECA: Record<TipoPeca, CampoPeca[]> = {
  replica: [
    {
      chave: "pontosContestacao",
      rotulo: "Principais pontos da contestação a impugnar",
      placeholder: "Resuma o que o réu alegou na contestação, ponto a ponto.",
    },
  ],
  agravo_tutela: [
    { chave: "decisaoAgravada", rotulo: "Teor da decisão agravada (o que foi indeferido)" },
    { chave: "fundamentoReforma", rotulo: "Por que a tutela deveria ter sido concedida" },
    { chave: "periculumInMora", rotulo: "Dano que a demora está causando (periculum in mora)" },
  ],
  embargos_declaracao: [
    { chave: "trechoDecisao", rotulo: "Trecho da decisão com o vício" },
    {
      chave: "oQueFaltaDecidir",
      rotulo: "O que ficou omisso, contraditório ou obscuro, e o que deveria ter sido decidido",
    },
  ],
  apelacao: [
    { chave: "razoesRecurso", rotulo: "Razões do recurso (por que a sentença está errada)" },
    { chave: "pedidoReforma", rotulo: "O que deve ser reformado ou anulado" },
  ],
  contrarrazoes_apelacao: [
    { chave: "argumentosApelante", rotulo: "O que o apelante alegou no recurso" },
    { chave: "contrarrazoes", rotulo: "Resposta a cada argumento do apelante" },
  ],
  cumprimento_sentenca: [
    { chave: "obrigacaoExequenda", rotulo: "O que a sentença determinou (valor ou obrigação)" },
    { chave: "valorAtualizado", rotulo: "Valor atualizado devido (se obrigação pecuniária)" },
  ],
  pedido_multa: [
    { chave: "obrigacaoDescumprida", rotulo: "Obrigação de fazer/não fazer descumprida" },
    { chave: "prazoConcedido", rotulo: "Prazo que foi dado e não cumprido" },
    { chave: "valorMultaSugerido", rotulo: "Valor da multa diária sugerido" },
  ],
  homologacao_acordo: [
    { chave: "termosAcordo", rotulo: "Termos do acordo celebrado entre as partes" },
  ],
  manifestacao_defesa: [
    {
      chave: "pontosDefesa",
      rotulo: "Principais pontos da defesa a impugnar",
      placeholder: "Resuma o que o reclamado alegou na defesa, ponto a ponto.",
    },
  ],
  recurso_ordinario: [
    { chave: "razoesRecurso", rotulo: "Razões do recurso (por que a sentença está errada)" },
    { chave: "pedidoReforma", rotulo: "O que deve ser reformado ou anulado" },
  ],
  contrarrazoes_recurso_ordinario: [
    { chave: "argumentosRecorrente", rotulo: "O que o recorrente alegou no recurso" },
    { chave: "contrarrazoes", rotulo: "Resposta a cada argumento do recorrente" },
  ],
  cumprimento_execucao_trabalhista: [
    { chave: "obrigacaoExequenda", rotulo: "O que a sentença/acordo determinou (verbas devidas)" },
    { chave: "valorCalculado", rotulo: "Valor apurado na planilha de cálculos" },
  ],
  impugnacao_calculos: [
    { chave: "calculosImpugnados", rotulo: "Quais cálculos ou critérios estão errados" },
    { chave: "criterioCorreto", rotulo: "Qual deveria ser o critério ou valor correto" },
  ],
  agravo_peticao: [
    { chave: "decisaoAgravada", rotulo: "Teor da decisão agravada, na fase de execução" },
    { chave: "fundamentoReforma", rotulo: "Por que a decisão deveria ser reformada" },
  ],
};

/** Peças com nome e rito específicos de uma área não fazem sentido nas demais — "Apelação" não
 * existe na Justiça do Trabalho (lá é "Recurso Ordinário"), e vice-versa. Peças genéricas
 * (embargos de declaração, tutela de urgência, homologação de acordo) não entram em nenhuma das
 * duas listas abaixo, e por isso ficam disponíveis em qualquer área. */
const SOMENTE_TRABALHISTA: TipoPeca[] = [
  "manifestacao_defesa",
  "recurso_ordinario",
  "contrarrazoes_recurso_ordinario",
  "cumprimento_execucao_trabalhista",
  "impugnacao_calculos",
  "agravo_peticao",
];
const EXCETO_TRABALHISTA: TipoPeca[] = [
  "replica",
  "apelacao",
  "contrarrazoes_apelacao",
  "cumprimento_sentenca",
];

export function tiposDisponiveisParaArea(area: LegalAreaSlug): TipoPeca[] {
  return tipoPecaSchema.options.filter((tipo) => {
    if (SOMENTE_TRABALHISTA.includes(tipo)) return area === "trabalhista";
    if (EXCETO_TRABALHISTA.includes(tipo)) return area !== "trabalhista";
    return true;
  });
}
