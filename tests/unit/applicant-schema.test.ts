import { describe, expect, it } from "vitest";
import { applicantSchema } from "@/domain/case/schema";

const valid = {
  fullName: "Maria da Silva",
  cpf: "111.444.777-35",
  email: "maria@example.com",
  phone: "(11) 91234-5678",
  city: "Campinas",
  uf: "SP",
  consentAccepted: true,
};

describe("applicantSchema", () => {
  it("aceita dados válidos e normaliza o telefone e o CPF", () => {
    const r = applicantSchema.parse(valid);
    expect(r.phone).toBe("11912345678");
    expect(r.cpf).toBe("11144477735");
  });

  it.each([
    ["fullName", "Maria", "Informe nome e sobrenome."],
    ["cpf", "111.444.777-36", "Informe um CPF válido."],
    ["cpf", "111.111.111-11", "Informe um CPF válido."],
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
