import { z } from "zod";
export function validTaxId(raw: string) {
  const v = raw.replace(/\D/g, "");
  if (![11, 14].includes(v.length) || /^(\d)\1+$/.test(v)) return false;
  const check = (base: string, weights: number[]) => {
    const sum = [...base].reduce((a, c, i) => a + Number(c) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  if (v.length === 11) {
    for (let len = 9; len <= 10; len++) {
      if (
        check(
          v.slice(0, len),
          Array.from({ length: len }, (_, i) => len + 1 - i),
        ) !== Number(v[len])
      )
        return false;
    }
  } else {
    if (check(v.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(v[12])) return false;
    if (check(v.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) !== Number(v[13]))
      return false;
  }
  return true;
}
export const credentials = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(8).max(128),
});
export const professionalFields = z.object({
  name: z.string().trim().min(2).max(120),
  cpfCnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine(validTaxId, "CPF/CNPJ inválido"),
  oabNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{1,9}[A-Z]?$/),
  oabState: z.enum([
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
  ]),
  plan: z.enum(["monthly", "yearly"]),
  terms: z.literal("on"),
});
export const registration = credentials
  .extend(professionalFields.shape)
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, "Senhas diferentes");
