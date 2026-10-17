import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requirePersonnelAccess } from "@/lib/auth/pessoal-acesso";
import { listPersonnel } from "@/lib/services/pessoal";
import { payrollKinds, netPayCents, totalEmployerCostCents } from "@/domain/pessoal/schema";
import { formatCents } from "@/domain/triage/money";
import { businessDate } from "@/domain/time";
import { PersonnelForm, personnelInput } from "./forms";
import { PrintReport } from "../forms";

export const dynamic="force-dynamic";
export const metadata={title:"Pessoal e Folha | Júris Office"};
const money=(v:string|number)=>formatCents(Number(v));
const formatDate=(s:string)=>s.split("-").reverse().join("/");
const label="block text-sm font-medium text-ink";
const kindNames:Record<string,string>=payrollKinds;
const statusNames:Record<string,string>={ativo:"Ativo",afastado:"Afastado",desligado:"Desligado"};
const eventNames:Record<string,string>={ferias:"Férias",falta:"Falta",afastamento:"Afastamento",licenca:"Licença"};
function SelectEmployee({employees}:{employees:{id:string;full_name:string;status:string}[]}) {
 return <label className={label}>Funcionário
  <select className={personnelInput} name="employeeId" required>
   <option value="">Selecione</option>
   {employees.filter(e=>e.status!=="desligado").map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}
  </select>
 </label>;
}
export default async function PersonnelPage({searchParams}:{
 searchParams:Promise<{period?:string}>}) {
 const {db,office}=await requirePersonnelAccess();
 const params=await searchParams;
 const today=businessDate(new Date());
 const period=/^\d{4}-(0[1-9]|1[0-2])$/.test(params.period??"")?
  `${params.period}-01`:today.slice(0,7)+"-01";
 const {employees,payroll,events}=await listPersonnel(db,office,period);
 const totalNet=payroll.reduce((sum,p)=>sum+netPayCents(p),0);
 const totalCost=payroll.reduce((sum,p)=>sum+totalEmployerCostCents(p),0);
 const paid=payroll.filter(p=>p.paid_on!==null).length;
 return <main className="mx-auto max-w-7xl space-y-8 px-5 py-10 sm:px-8">
  <div className="flex flex-wrap items-center justify-between gap-4">
   <div><Link href="/equipe/financeiro" className="text-sm text-muted hover:underline">← Financeiro</Link>
    <h1 className="mt-2 text-3xl">Pessoal e Folha de Pagamento</h1>
    <p className="mt-2 max-w-3xl text-muted">Controle administrativo manual dos funcionários, salários, férias, 13º e encargos do escritório.</p>
   </div>
   <div className="flex flex-wrap gap-2 print:hidden">
    <a href={`/equipe/financeiro/pessoal/relatorio?period=${period.slice(0,7)}`} className="rounded-md border border-line bg-surface px-4 py-2 text-sm">Exportar CSV</a>
    <PrintReport />
   </div>
  </div>
  <p className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
   O sistema não calcula tributos oficiais, não transmite eSocial, não gera guias nem efetua pagamentos.
   Os valores de descontos e encargos são informados e revisados pelo escritório e sua contabilidade.
   A folha não é lançada automaticamente como despesa no Financeiro, evitando duplicidade; os pagamentos
   e encargos podem ser registrados manualmente na aba Financeiro após conferência.
  </p>
  <form className="flex items-end gap-3 print:hidden">
   <label className={label}>Competência
    <input type="month" name="period" defaultValue={period.slice(0,7)} className={personnelInput}/>
   </label>
   <button className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white">Consultar</button>
  </form>
  <div className="grid gap-3 sm:grid-cols-4">
   {[
    ["Funcionários",String(employees.length)],["Folhas da competência",String(payroll.length)],
    ["Líquido informado",money(totalNet)],["Custo total previsto",money(totalCost)]
   ].map(([title,value])=><div key={title} className="rounded-xl border border-line bg-surface p-4">
    <p className="text-xs text-muted">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p>
   </div>)}
  </div>
  <section aria-labelledby="title-employees" className="rounded-xl border border-line bg-surface p-5">
   <h2 id="title-employees" className="text-xl">Funcionários e colaboradores</h2>
   <p className="mt-1 text-sm text-muted">Funcionários não são criados automaticamente a partir dos advogados cadastrados no aplicativo.</p>
   <details className="mt-4 print:hidden"><summary className="cursor-pointer font-semibold">Cadastrar funcionário</summary>
    <div className="mt-4 max-w-4xl"><PersonnelForm label="Cadastrar funcionário">
     <input type="hidden" name="operation" value="employee"/><input type="hidden" name="id" value={randomUUID()}/>
     <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>Nome completo<input required name="fullName" minLength={3} maxLength={160} className={personnelInput}/></label>
      <label className={label}>CPF (somente números; opcional)<input name="cpf" inputMode="numeric" pattern="[0-9]{11}" maxLength={11} autoComplete="off" className={personnelInput}/></label>
      <label className={label}>Cargo / função<input required name="jobTitle" maxLength={120} className={personnelInput}/></label>
      <label className={label}>Tipo de vínculo<select name="employmentKind" className={personnelInput}>
       <option value="clt">CLT</option><option value="estagio">Estágio</option><option value="associado">Associado</option>
       <option value="prestador">Prestador</option><option value="outro">Outro</option>
      </select></label>
      <label className={label}>Data de admissão/início<input type="date" required name="hiredOn" defaultValue={today} className={personnelInput}/></label>
      <label className={label}>Remuneração mensal de referência (R$)<input required name="monthlySalary" inputMode="decimal" placeholder="2500,00" className={personnelInput}/></label>
      <label className={label}>Horas semanais<input required name="weeklyHours" type="number" min="0" max="60" step=".5" defaultValue="44" className={personnelInput}/></label>
      <label className={label}>Observações<input name="notes" maxLength={2000} className={personnelInput}/></label>
     </div>
    </PersonnelForm></div>
   </details>
   <div className="mt-5 overflow-x-auto">
    <table className="w-full min-w-[700px] text-left text-sm">
     <thead><tr className="border-b border-line text-muted"><th className="py-3">Nome / função</th><th>Vínculo</th><th>Início</th><th>Salário ref.</th><th>Situação</th><th className="print:hidden">Atualizar</th></tr></thead>
     <tbody>{employees.map(e=><tr key={e.id} className="border-b border-line">
      <td className="py-3"><strong>{e.full_name}</strong><br/>{e.job_title}</td>
      <td>{e.employment_kind.toUpperCase()}</td><td>{formatDate(e.hired_on)}</td>
      <td>{money(e.monthly_salary_cents)}</td><td>{statusNames[e.status]??e.status}</td>
      <td className="print:hidden"><details><summary className="cursor-pointer text-navy">Editar</summary>
       <PersonnelForm label="Salvar alteração">
        <input type="hidden" name="operation" value="employee-update"/><input type="hidden" name="id" value={e.id}/>
        <label className={label}>Situação<select name="status" defaultValue={e.status} className={personnelInput}>
         <option value="ativo">Ativo</option><option value="afastado">Afastado</option><option value="desligado">Desligado</option>
        </select></label>
        <label className={label}>Remuneração de referência (R$)<input required name="monthlySalary" inputMode="decimal" defaultValue={(Number(e.monthly_salary_cents)/100).toFixed(2)} className={personnelInput}/></label>
       </PersonnelForm>
      </details></td>
     </tr>)}</tbody>
    </table>
    {!employees.length && <p className="py-5 text-sm text-muted">Nenhum funcionário cadastrado.</p>}
   </div>
  </section>
  <section className="rounded-xl border border-line bg-surface p-5">
   <h2 className="text-xl">Folha por competência</h2>
   <p className="mt-1 text-sm text-muted">Salário líquido = base + adicionais − descontos. Custo patronal gerencial = base + adicionais + encargos do empregador + benefícios. Valores manuais, sem aplicação de tabelas tributárias.</p>
   {employees.length>0 && <details className="mt-4 print:hidden"><summary className="cursor-pointer font-semibold">Novo lançamento de folha</summary>
    <div className="mt-4 max-w-4xl"><PersonnelForm label="Registrar folha em rascunho">
     <input type="hidden" name="operation" value="payroll"/><input type="hidden" name="id" value={randomUUID()}/>
     <div className="grid gap-3 sm:grid-cols-2">
      <SelectEmployee employees={employees}/>
      <label className={label}>Tipo de folha<select name="kind" className={personnelInput}>{Object.entries(payrollKinds).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
      <label className={label}>Competência (primeiro dia)<input required type="date" name="period" defaultValue={period} className={personnelInput}/></label>
      <label className={label}>Vencimento do pagamento<input required type="date" name="dueOn" defaultValue={today} className={personnelInput}/></label>
      {[
       ["base","Salário-base / vencimento (R$)"],["additions","Adicionais, férias ou 1/3 (R$)"],
       ["deductions","Descontos totais (R$)"],["employerCharges","Encargos patronais (R$)"],
       ["benefits","Benefícios custeados pelo escritório (R$)"]
      ].map(([name,title])=><label key={name} className={label}>{title}
       <input name={name} inputMode="decimal" defaultValue={name==="base"?"": "0"} required={name==="base"} className={personnelInput}/>
      </label>)}
      <label className={label}>Observações<input name="notes" className={personnelInput} maxLength={2000}/></label>
     </div>
    </PersonnelForm></div>
   </details>}
   <div className="mt-5 overflow-x-auto">
    <table className="w-full min-w-[760px] text-left text-sm">
     <thead><tr className="border-b border-line text-muted"><th className="py-3">Funcionário / rubrica</th><th>Bruto</th><th>Descontos</th><th>Líquido</th><th>Patronal + benefícios</th><th>Estado</th><th className="print:hidden">Ação</th></tr></thead>
     <tbody>{payroll.map(p=><tr key={p.id} className="border-b border-line">
      <td className="py-3"><strong>{p.full_name}</strong><br/>{kindNames[p.kind]??p.kind}<br/><span className="text-xs text-muted">Venc. {formatDate(p.due_on)}</span></td>
      <td>{money(Number(p.base_cents)+Number(p.additions_cents))}</td><td>{money(p.deductions_cents)}</td>
      <td>{money(netPayCents(p))}</td><td>{money(Number(p.employer_charges_cents)+Number(p.benefits_cents))}</td>
      <td>{p.paid_on?"Pago em "+formatDate(p.paid_on):p.status==="fechada"?"Fechada":"Rascunho"}</td>
      <td className="print:hidden">{p.status==="rascunho"?
       <PersonnelForm label="Fechar folha"><input type="hidden" name="operation" value="close"/><input type="hidden" name="id" value={p.id}/></PersonnelForm>:
       !p.paid_on?<PersonnelForm label="Registrar pagamento">
        <input type="hidden" name="operation" value="paid"/><input type="hidden" name="id" value={p.id}/>
        <label className={label}>Data<input required type="date" name="paidOn" defaultValue={today} max={today} className={personnelInput}/></label>
       </PersonnelForm>:<span className="text-muted">Concluída</span>}
      </td>
     </tr>)}</tbody>
    </table>
    {!payroll.length&&<p className="py-5 text-sm text-muted">Nenhuma folha registrada para a competência selecionada.</p>}
   </div>
   <p className="mt-4 text-sm text-muted">{paid} de {payroll.length} folha(s) com pagamento informado. Fechamentos não podem ser modificados; corrija dados antes de fechar.</p>
  </section>
  <section className="rounded-xl border border-line bg-surface p-5">
   <h2 className="text-xl">Férias e ausências</h2>
   <p className="mt-1 text-sm text-muted">Controle de períodos informados. Direitos, saldo legal de férias e afastamentos devem ser conferidos com a contabilidade.</p>
   {employees.length>0&&<details className="mt-4 print:hidden"><summary className="cursor-pointer font-semibold">Registrar período</summary>
    <div className="mt-4 max-w-3xl"><PersonnelForm label="Salvar ocorrência">
     <input type="hidden" name="operation" value="event"/><input type="hidden" name="id" value={randomUUID()}/>
     <div className="grid gap-3 sm:grid-cols-2">
      <SelectEmployee employees={employees}/>
      <label className={label}>Ocorrência<select name="kind" className={personnelInput}>{Object.entries(eventNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className={label}>Início<input required type="date" name="startsOn" defaultValue={today} className={personnelInput}/></label>
      <label className={label}>Fim<input required type="date" name="endsOn" defaultValue={today} className={personnelInput}/></label>
      <label className={label}>Observações<input name="notes" maxLength={2000} className={personnelInput}/></label>
     </div>
    </PersonnelForm></div>
   </details>}
   <ul className="mt-5 space-y-2 text-sm">{events.map(e=><li key={e.id} className="rounded-md border border-line p-3">
    <strong>{e.full_name}</strong> — {eventNames[e.kind]??e.kind} · {formatDate(e.starts_on)} a {formatDate(e.ends_on)}
    {e.notes&&<p className="text-muted">{e.notes}</p>}
   </li>)}</ul>
   {!events.length&&<p className="mt-4 text-sm text-muted">Nenhum afastamento ou período de férias registrado.</p>}
  </section>
 </main>;
}
