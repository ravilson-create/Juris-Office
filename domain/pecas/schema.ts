import { z } from "zod";

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
};
