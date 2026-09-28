import { businessDate } from "@/domain/time";

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para facilitar leitura por telefone. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type RandomSource = (size: number) => Uint8Array;

const defaultRandom: RandomSource = (size) => crypto.getRandomValues(new Uint8Array(size));

/**
 * Gera protocolo no formato JO-AAAAMMDD-XXXXXX (ex.: JO-20260927-K7M2QX).
 * AAAAMMDD é o dia de **criação** do atendimento no fuso de negócio (America/Sao_Paulo),
 * não o dia do envio. A unicidade vem do sufixo aleatório (31^6 ≈ 887 milhões por dia);
 * em produção deve ser garantida também por restrição UNIQUE no banco.
 */
export function generateProtocol(
  date: Date = new Date(),
  random: RandomSource = defaultRandom,
): string {
  const day = businessDate(date).replaceAll("-", "");
  const suffix = Array.from(random(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `JO-${day}-${suffix}`;
}

export const PROTOCOL_PATTERN = /^JO-\d{8}-[2-9A-HJKMNP-Z]{6}$/;

export function isValidProtocol(value: string): boolean {
  return PROTOCOL_PATTERN.test(value);
}
