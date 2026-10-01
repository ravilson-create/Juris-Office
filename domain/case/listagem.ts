export const TAMANHO_PAGINA_EQUIPE = 20;

export type Paginacao = {
  /** Página efetiva (sempre dentro de [1, totalPaginas]; nunca o valor bruto da URL). */
  pagina: number;
  totalPaginas: number;
  offset: number;
};

/**
 * Nunca confia na página pedida na URL: usuário pode digitar `?pagina=0`, `?pagina=-5` ou
 * `?pagina=9999` manualmente. Sempre encaixa num intervalo válido antes de montar a query SQL.
 */
export function calcularPaginacao(
  totalItens: number,
  paginaSolicitada: number,
  tamanhoPagina: number = TAMANHO_PAGINA_EQUIPE,
): Paginacao {
  const totalPaginas = Math.max(1, Math.ceil(totalItens / tamanhoPagina));
  const pagina = Math.min(Math.max(1, Math.trunc(paginaSolicitada) || 1), totalPaginas);
  return { pagina, totalPaginas, offset: (pagina - 1) * tamanhoPagina };
}
