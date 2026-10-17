import { z } from "zod";
import { civilDate, moneyInput } from "@/domain/financeiro/schema";

export const currencyCents = (value: FormDataEntryValue | null) =>
  value === null || String(value).trim() === "" || String(value).trim() === "0"
    ? 0
    : moneyInput(value);

export const employeeSchema = z.object({
  id: z.uuid(),
  fullName: z.string().trim().min(3).max(160),
  cpf: z.union([z.literal(""), z.string().regex(/^\d{11}$/, "CPF deve conter 11 números.")]),
  jobTitle: z.string().trim().min(2).max(120),
  employmentKind: z.enum(["clt", "estagio", "associado", "prestador", "outro"]),
  hiredOn: civilDate,
  monthlySalaryCents: z.number().int().min(0).max(100_000_000_000),
  weeklyHours: z.number().min(0).max(60),
  notes: z.string().trim().max(2000),
});
export const payrollKinds = {
  mensal: "Folha mensal",
  decimo_terceiro: "13º salário",
  ferias: "Férias",
  rescisao: "Rescisão",
} as const;
export const payrollSchema = z.object({
  id: z.uuid(),
  employeeId: z.uuid(),
  period: civilDate.refine(v => v.endsWith("-01"), "Competência deve iniciar no dia 01."),
  kind: z.enum(["mensal", "decimo_terceiro", "ferias", "rescisao"]),
  baseCents: z.number().int().min(0).max(100_000_000_000),
  additionsCents: z.number().int().min(0).max(100_000_000_000),
  deductionsCents: z.number().int().min(0).max(100_000_000_000),
  employerChargesCents: z.number().int().min(0).max(100_000_000_000),
  benefitsCents: z.number().int().min(0).max(100_000_000_000),
  dueOn: civilDate,
  notes: z.string().trim().max(2000),
}).refine(v => v.baseCents + v.additionsCents > 0, "Informe um vencimento.")
  .refine(v => v.deductionsCents <= v.baseCents + v.additionsCents,
    "Descontos não podem superar os vencimentos.");
export const eventSchema = z.object({
  id: z.uuid(), employeeId: z.uuid(),
  kind: z.enum(["ferias", "falta", "afastamento", "licenca"]),
  startsOn: civilDate, endsOn: civilDate,
  notes: z.string().trim().max(2000),
}).refine(v => v.endsOn >= v.startsOn, "Período inválido.");

export const netPayCents = (p: {
  base_cents: string | number; additions_cents: string | number; deductions_cents: string | number;
}) => Number(p.base_cents) + Number(p.additions_cents) - Number(p.deductions_cents);
export const totalEmployerCostCents = (p: {
  base_cents: string | number; additions_cents: string | number;
  employer_charges_cents: string | number; benefits_cents: string | number;
}) => Number(p.base_cents) + Number(p.additions_cents) +
  Number(p.employer_charges_cents) + Number(p.benefits_cents);
