import { requirePersonnelAccess } from "@/lib/auth/pessoal-acesso";
import { listPersonnel } from "@/lib/services/pessoal";
import { csvCell } from "@/domain/financeiro/schema";
import { netPayCents,totalEmployerCostCents } from "@/domain/pessoal/schema";
import { businessDate } from "@/domain/time";

export const dynamic="force-dynamic";
export async function GET(request:Request){
 const {db,office}=await requirePersonnelAccess();
 const url=new URL(request.url);
 const raw=url.searchParams.get("period")??businessDate(new Date()).slice(0,7);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return new Response("Competência inválida.",{status:400});
 const {payroll}=await listPersonnel(db,office,raw+"-01");
 if(payroll.length>=1000) return new Response("Relatório grande: filtre ou consulte suporte.",{status:422});
 const data=[
 ["Funcionário","Competência","Tipo","Base (centavos)","Adicionais (centavos)","Descontos (centavos)",
 "Líquido (centavos)","Encargos patronais (centavos)","Benefícios (centavos)","Custo total (centavos)",
 "Vencimento","Pago em","Estado"],
 ...payroll.map(p=>[p.full_name,p.period,p.kind,p.base_cents,p.additions_cents,p.deductions_cents,
 String(netPayCents(p)),p.employer_charges_cents,p.benefits_cents,String(totalEmployerCostCents(p)),
 p.due_on,p.paid_on??"",p.status])
 ];
 const csv="\uFEFF"+data.map(line=>line.map(csvCell).join(";")).join("\r\n")+"\r\n";
 return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8",
 "Content-Disposition":`attachment; filename="folha-${raw}.csv"`,"Cache-Control":"private, no-store",
 "X-Content-Type-Options":"nosniff"}});
}
