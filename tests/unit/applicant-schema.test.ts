import { describe, expect, it } from "vitest";
import { applicantSchema } from "@/domain/case/schema";

const valid = {
  fullName: "Maria da Silva",
  email: "maria@example.com",
  phone: "(11) 91234-5678",
  city: "Campinas",
  uf: "SP",
  consentAccepted: true,
};

describe("applicantSchema", () => {
  it("aceita dados válidos e normaliza o telefone", () => {
    const r = applicantSchema.parse(valid);
    expect(r.phone).toBe("11912345678");
  });

  it.each([
    ["fullName", "Maria", "Informe nome e sobrenome."],
    ["email", "maria@", "Informe um e-mail válido."],
    ["phone", "1234", "Informe o telefone com DDD, por exemplo (11) 91234-5678."],
    ["uf", "XX", "Selecione o estado (UF)."],
  ])("rejeita %s inválido", (field, value, message) => {
    const r = applicantSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(message);
  });

  it("exige ciência sobre o tratamento de dados", () => {
    const r = applicantSchema.safeParse({ ...valid, consentAccepted: false });
    expect(r.success).toBe(false);
  });
});
