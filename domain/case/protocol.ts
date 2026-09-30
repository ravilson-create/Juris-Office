import { businessDate } from "@/domain/time";

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) para facilitar leitura por telefone. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type RandomSource = (size: number) => Uint8Array;

const defaultRandom: RandomSource = (size) => crypto.getRandomValues(new Uint8Array(size));

/** Protocolo de consulta: 28 caracteres aleatórios (>128 bits), além da data.
 * O protocolo funciona como credencial de leitura limitada do andamento.
 */
export function generateProtocol(
  date: Date = new Date(),
  random: RandomSource = defaultRandom,
): string {
  const day = businessDate(date).replaceAll("-", "");
  const suffix = Array.from(random(28), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `JO-${day}-${suffix}`;
}

export const PROTOCOL_PATTERN = /^JO-\d{8}-[2-9A-HJKMNP-Z]{28}$/;

export function isValidProtocol(value: string): boolean {
  return PROTOCOL_PATTERN.test(value);
}
