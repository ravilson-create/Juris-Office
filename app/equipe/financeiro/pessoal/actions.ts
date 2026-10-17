"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { businessDate } from "@/domain/time";
import { civilDate } from "@/domain/financeiro/schema";
import { currencyCents, employeeSchema, payrollSchema, eventSchema } from "@/domain/pessoal/schema";
import { requirePersonnelAccess } from "@/lib/auth/pessoal-acesso";
import { createEmployee, updateEmployee, createPayroll, closePayroll, markPayrollPaid, createPersonnelEvent } from "@/lib/services/pessoal";

export type PersonnelActionState = {ok:boolean;message:string};
const text = (form:FormData, name:string) => String(form.get(name) ?? "").trim();
const money = (form:FormData, name:string) => currencyCents(form.get(name));
export async function personnelAction(_prev:PersonnelActionState,form:FormData):Promise<PersonnelActionState> {
 const {db,actor,office}=await requirePersonnelAccess();
 try {
  const op=text(form,"operation");
  if (op==="employee") {
   await createEmployee(db,actor,office,employeeSchema.parse({
    id:text(form,"id"),fullName:text(form,"fullName"),
    cpf:text(form,"cpf").replace(/\D/g,""),jobTitle:text(form,"jobTitle"),
    employmentKind:text(form,"employmentKind"),hiredOn:text(form,"hiredOn"),
    monthlySalaryCents:money(form,"monthlySalary"),weeklyHours:Number(text(form,"weeklyHours")),
    notes:text(form,"notes"),
   }));
  } else if(op==="employee-update") {
   const id=z.uuid().parse(text(form,"id"));
   const status=z.enum(["ativo","afastado","desligado"]).parse(text(form,"status"));
   const result=await updateEmployee(db,office,id,status,money(form,"monthlySalary"));
   if (!result.length) throw new Error("Funcionário indisponível.");
  } else if(op==="payroll") {
   await createPayroll(db,actor,office,payrollSchema.parse({
    id:text(form,"id"),employeeId:text(form,"employeeId"),period:text(form,"period"),
    kind:text(form,"kind"),baseCents:money(form,"base"),additionsCents:money(form,"additions"),
    deductionsCents:money(form,"deductions"),
    employerChargesCents:money(form,"employerCharges"),benefitsCents:money(form,"benefits"),
    dueOn:text(form,"dueOn"),notes:text(form,"notes"),
   }));
  } else if(op==="close") {
   const result=await closePayroll(db,office,z.uuid().parse(text(form,"id")));
   if (!result.length) throw new Error("Folha indisponível.");
  } else if(op==="paid") {
   const date=civilDate.parse(text(form,"paidOn"));
   if(date>businessDate(new Date())) throw new Error("A data do pagamento não pode ser futura.");
   const result=await markPayrollPaid(db,office,z.uuid().parse(text(form,"id")),date);
   if (!result.length) throw new Error("Folha não pode receber baixa.");
  } else if(op==="event") {
   await createPersonnelEvent(db,actor,office,eventSchema.parse({
    id:text(form,"id"),employeeId:text(form,"employeeId"),kind:text(form,"kind"),
    startsOn:text(form,"startsOn"),endsOn:text(form,"endsOn"),notes:text(form,"notes"),
   }));
  } else throw new Error("Operação não reconhecida.");
 } catch(e) {
  const message=e instanceof z.ZodError ? (e.issues[0]?.message ?? "Dados inválidos.") :
   "Não foi possível salvar. Confira os campos, vínculos e possíveis registros duplicados.";
  return {ok:false,message};
 }
 revalidatePath("/equipe/financeiro/pessoal");
 return {ok:true,message:"Registro salvo. Consulte o quadro atualizado."};
}
