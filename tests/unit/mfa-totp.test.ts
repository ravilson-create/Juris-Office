import { describe, expect, it } from "vitest";
import {
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  otpauthUrl,
  totpAt,
  verifyTotp,
} from "@/domain/mfa/totp";

describe("TOTP (RFC 6238)", () => {
  // Vetor de teste oficial da RFC 6238 (segredo ASCII "12345678901234567890", SHA1, 8 dígitos no
  // documento — aqui conferimos só os 6 últimos dígitos, que é o que geramos, no instante T=59s).
  const SEGREDO_RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // base32 de "12345678901234567890"

  it("bate com o vetor de teste oficial em T=59s (código completo 94287082 → 6 últimos = 287082)", () => {
    expect(totpAt(SEGREDO_RFC, 59_000)).toBe("287082");
  });

  it("gera um código de 6 dígitos sempre numérico", () => {
    const secret = generateTotpSecret();
    const code = totpAt(secret, Date.now());
    expect(code).toMatch(/^\d{6}$/);
  });

  it("verifyTotp aceita o código do instante atual e rejeita um código aleatório", () => {
    const secret = generateTotpSecret();
    const code = totpAt(secret, Date.now());
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, "000000" === code ? "111111" : "000000")).toBe(false);
  });

  it("tolera ±1 período (30s) de deriva de relógio, mas não mais que isso", () => {
    const secret = generateTotpSecret();
    const agora = Date.now();
    const umPeriodoAntes = totpAt(secret, agora - 30_000);
    const doisPeriodosAntes = totpAt(secret, agora - 60_000);
    expect(verifyTotp(secret, umPeriodoAntes, agora)).toBe(true);
    expect(verifyTotp(secret, doisPeriodosAntes, agora)).toBe(false);
  });

  it("rejeita entrada que não seja exatamente 6 dígitos", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });

  it("otpauthUrl inclui o segredo e os parâmetros padrão do protocolo", () => {
    const url = otpauthUrl("ABCDEF", "advogado@escritorio.com");
    expect(url).toContain("otpauth://totp/");
    expect(url).toContain("secret=ABCDEF");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });

  it("gera códigos de backup únicos e o hash é determinístico e insensível a maiúsculas", () => {
    const codigos = generateBackupCodes(8);
    expect(codigos).toHaveLength(8);
    expect(new Set(codigos).size).toBe(8);
    expect(hashBackupCode(codigos[0]!)).toBe(hashBackupCode(codigos[0]!.toUpperCase()));
    expect(hashBackupCode(codigos[0]!)).not.toBe(hashBackupCode(codigos[1]!));
  });
});
