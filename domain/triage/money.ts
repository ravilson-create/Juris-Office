/**
 * Valores monetários em reais, com precisão de centavos inteiros.
 *
 * Formatos aceitos (prefixo "R$" opcional, espaços nas pontas ignorados):
 *   1234        → R$ 1.234,00
 *   1.234       → R$ 1.234,00   (ponto como separador de milhar: grupos de 3 dígitos)
 *   1234,56     → R$ 1.234,56
 *   1.234,56    → R$ 1.234,56
 *   1234.56     → R$ 1.234,56   (ponto decimal, só com 1 ou 2 casas e sem milhar)
 * Recusados: agrupamento inválido ("1.2.3", "12.34.567"), mais de 2 casas ("1.2345", "1,234"),
 * separadores misturados fora do padrão ("1,234.56"), sinais, letras e valores acima do limite.
 * Entrada inválida nunca é convertida em outro valor.
 */
export const MONEY_MAX_CENTS = 100_000_000_000; // R$ 1.000.000.000,00
const MAX_INPUT_LENGTH = 30;

const PATTERNS: Array<{ re: RegExp; decimalSep: "," | "." | null }> = [
  { re: /^\d+$/, decimalSep: null },
  { re: /^\d{1,3}(\.\d{3})+$/, decimalSep: null },
  { re: /^\d+,\d{1,2}$/, decimalSep: "," },
  { re: /^\d{1,3}(\.\d{3})+,\d{1,2}$/, decimalSep: "," },
  { re: /^\d+\.\d{1,2}$/, decimalSep: "." },
];

export type MoneyParse = { ok: true; cents: number } | { ok: false; error: string };

export const MONEY_FORMAT_ERROR = "Use um valor como 1.250,00 ou 1250,00.";

export function parseMoney(input: string): MoneyParse {
  const s = input.trim().replace(/^R\$\s*/i, "");
  if (!s || s.length > MAX_INPUT_LENGTH) return { ok: false, error: MONEY_FORMAT_ERROR };
  const match = PATTERNS.find((p) => p.re.test(s));
  if (!match) return { ok: false, error: MONEY_FORMAT_ERROR };

  let intPart = s;
  let fracPart = "";
  if (match.decimalSep) {
    const at = s.lastIndexOf(match.decimalSep);
    intPart = s.slice(0, at);
    fracPart = s.slice(at + 1);
  }
  const intDigits = intPart.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  // Mais de 10 dígitos inteiros já passa de R$ 1 bilhão; evita números imprecisos.
  if (intDigits.length > 10) return { ok: false, error: maxError() };
  const cents = Number(intDigits) * 100 + Number(fracPart.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(cents) || cents > MONEY_MAX_CENTS)
    return { ok: false, error: maxError() };
  return { ok: true, cents };
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function maxError() {
  return `O valor máximo aceito é ${formatCents(MONEY_MAX_CENTS)}.`;
}

/** Reais (como gravado nas respostas) → centavos inteiros, sem erro de ponto flutuante. */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}
