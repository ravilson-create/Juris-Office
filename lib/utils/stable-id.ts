/**
 * Gera um UUID v4 determinístico a partir de uma semente.
 * Usado apenas nos dados mock para manter IDs estáveis entre reinícios.
 */
export function stableId(seed: string): string {
  const hex: string[] = [];
  let h = 0x811c9dc5;
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i) + round;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    hex.push(h.toString(16).padStart(8, "0"));
  }
  const s = hex.join("");
  const variant = ((parseInt(s[16], 16) & 0x3) | 0x8).toString(16);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${variant}${s.slice(17, 20)}-${s.slice(20, 32)}`;
}
