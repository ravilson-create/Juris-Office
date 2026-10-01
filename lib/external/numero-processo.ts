/**
 * Lógica pura sobre o número CNJ do processo — sem rede, por isso fora de datajud.ts (que tem
 * "server-only" e não pode ser importado em teste de unidade comum).
 */

/** Remove tudo que não for dígito (pontos, traços) do número CNJ do processo. */
export function normalizarNumeroProcesso(numero: string): string {
  return numero.replace(/\D/g, "");
}

/** O número CNJ unificado tem sempre 20 dígitos (NNNNNNN-DD.AAAA.J.TR.OOOO sem a pontuação). */
export function numeroProcessoValido(numero: string): boolean {
  return normalizarNumeroProcesso(numero).length === 20;
}
