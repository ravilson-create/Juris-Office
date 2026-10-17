import { describe, expect, it } from "vitest";
import { employeeSchema, payrollSchema, eventSchema, netPayCents, totalEmployerCostCents, currencyCents } from "@/domain/pessoal/schema";

const payroll={
 id:crypto.randomUUID(),employeeId:crypto.randomUUID(),period:"2026-10-01",
 kind:"mensal",baseCents:250000,additionsCents:35000,deductionsCents:35000,
 employerChargesCents:20000,benefitsCents:10000,dueOn:"2026-10-31",notes:""
} as const;
describe("Pessoal e folha manual",()=>{
 it("calcula líquido e custo gerencial sem confundir descontos com custos",()=>{
  expect(netPayCents({base_cents:"250000",additions_cents:"35000",deductions_cents:"35000"})).toBe(250000);
  expect(totalEmployerCostCents({base_cents:"250000",additions_cents:"35000",employer_charges_cents:"20000",benefits_cents:"10000"})).toBe(315000);
 });
 it("valida competência, desconto máximo e período",()=>{
  expect(payrollSchema.safeParse(payroll).success).toBe(true);
  expect(payrollSchema.safeParse({...payroll,period:"2026-10-17"}).success).toBe(false);
  expect(payrollSchema.safeParse({...payroll,deductionsCents:285001}).success).toBe(false);
  expect(eventSchema.safeParse({id:crypto.randomUUID(),employeeId:crypto.randomUUID(),kind:"ferias",
   startsOn:"2026-11-02",endsOn:"2026-11-01",notes:""}).success).toBe(false);
 });
 it("cadastro exige CPF válido em comprimento, data e cargo",()=>{
  const base={id:crypto.randomUUID(),fullName:"Maria Silva",cpf:"",jobTitle:"Assistente",
   employmentKind:"clt",hiredOn:"2026-10-17",monthlySalaryCents:250000,weeklyHours:44,notes:""};
  expect(employeeSchema.safeParse(base).success).toBe(true);
  expect(employeeSchema.safeParse({...base,cpf:"123"}).success).toBe(false);
 });
 it("interpreta valores em centavos sem ponto flutuante",()=>{
  expect(currencyCents("1250,51")).toBe(125051);
  expect(currencyCents("")).toBe(0);
  expect(currencyCents("0")).toBe(0);
  expect(()=>currencyCents("1.250,51")).toThrow();
 });
});
