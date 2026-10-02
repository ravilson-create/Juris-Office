import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) sobre HOTP (RFC 4226), implementado direto com `node:crypto` — sem depender de
 * um pacote externo para um algoritmo de ~30 linhas, compatível com qualquer app autenticador
 * (Google Authenticator, Authy etc.) que suporte o padrão `otpauth://`.
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Segredo novo para um cadastro de MFA — 160 bits, o tamanho recomendado pela RFC 4226. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totpAt(secret: string, epochMs: number): string {
  return hotp(secret, Math.floor(epochMs / 1000 / STEP_SECONDS));
}

/**
 * Aceita uma janela de ±1 período (30s) ao redor do instante atual, para tolerar o relógio do
 * celular estar um pouco adiantado ou atrasado — sem isso, o código do usuário falha com
 * frequência incômoda perto da virada de cada período.
 */
export function verifyTotp(secret: string, token: string, now = Date.now(), window = 1): boolean {
  const clean = token.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const tokenBuf = Buffer.from(clean);
  for (let step = -window; step <= window; step++) {
    const candidate = Buffer.from(totpAt(secret, now + step * STEP_SECONDS * 1000));
    if (timingSafeEqual(candidate, tokenBuf)) return true;
  }
  return false;
}

export function otpauthUrl(secret: string, accountLabel: string, issuer = "Juris Office"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
    algorithm: "SHA1",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Códigos de uso único para quando o celular com o autenticador não está à mão. */
export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex"));
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}
