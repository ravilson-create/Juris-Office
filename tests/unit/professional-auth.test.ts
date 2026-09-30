import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { paidPeriodEnd } from "@/lib/billing/period";
import { registration, validTaxId } from "@/domain/user/registration";
describe("cadastro e cobrança profissional", () => {
  it("usa hash salgado e rejeita senha errada e formato inválido", async () => {
    const hash = await hashPassword("UmaSenhaDeTeste!2026");
    expect(hash).not.toContain("UmaSenha");
    expect(await verifyPassword("UmaSenhaDeTeste!2026", hash)).toBe(true);
    expect(await verifyPassword("OutraSenha", hash)).toBe(false);
    expect(await verifyPassword("senha", "invalid")).toBe(false);
    expect(await hashPassword("UmaSenhaDeTeste!2026")).not.toBe(hash);
  });
  it("calcula o período pago sem confundir vencimento e fim de acesso", () => {
    expect(paidPeriodEnd("2026-01-31", "monthly").toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(paidPeriodEnd("2028-02-29", "yearly").toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });
  it("exige CPF/CNPJ válido, OAB, aceite e confirmação de senha", () => {
    expect(validTaxId("11111111111")).toBe(false);
    const input = {
      name: "Advogado Teste",
      email: "teste@example.com",
      password: "senhaSegura123",
      confirmPassword: "senhaSegura123",
      cpfCnpj: "52998224725",
      oabNumber: "12345",
      oabState: "MA",
      plan: "monthly",
      terms: "on",
    };
    expect(registration.safeParse(input).success).toBe(true);
    expect(registration.safeParse({ ...input, confirmPassword: "outra" }).success).toBe(false);
    expect(registration.safeParse({ ...input, terms: false }).success).toBe(false);
  });
});
