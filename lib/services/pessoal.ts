import "server-only";
import type { Db } from "@/lib/db/types";
import type { z } from "zod";
import { employeeSchema, payrollSchema, eventSchema } from "@/domain/pessoal/schema";
type Employee = z.infer<typeof employeeSchema>;
type Payroll = z.infer<typeof payrollSchema>;
type Event = z.infer<typeof eventSchema>;

export type PersonnelEmployee = {
  id:string; full_name:string; cpf:string|null; job_title:string; employment_kind:string;
  hired_on:string; monthly_salary_cents:string; weekly_hours:string; status:string; notes:string;
};
export type PersonnelPayroll = {
  id:string; employee_id:string; full_name:string; period:string; kind:string;
  base_cents:string; additions_cents:string; deductions_cents:string;
  employer_charges_cents:string; benefits_cents:string; due_on:string;
  paid_on:string|null; status:string; notes:string;
};
export type PersonnelEvent = {
  id:string; full_name:string; kind:string; starts_on:string; ends_on:string; notes:string;
};

export async function listPersonnel(db:Db, office:string, period:string) {
 const [employees,payroll,events] = await Promise.all([
  db.query<PersonnelEmployee>(
   `SELECT id,full_name,cpf,job_title,employment_kind,hired_on::text,monthly_salary_cents::text,
    weekly_hours::text,status,notes FROM office_employees WHERE office_id=$1 ORDER BY full_name LIMIT 500`,
   [office]),
  db.query<PersonnelPayroll>(
   `SELECT p.id,p.employee_id,e.full_name,p.period::text,p.kind,p.base_cents::text,
    p.additions_cents::text,p.deductions_cents::text,p.employer_charges_cents::text,
    p.benefits_cents::text,p.due_on::text,p.paid_on::text,p.status,p.notes
    FROM office_payroll p JOIN office_employees e ON e.id=p.employee_id
    WHERE p.office_id=$1 AND p.period=$2::date ORDER BY e.full_name,p.kind LIMIT 1000`,
   [office,period]),
  db.query<PersonnelEvent>(
   `SELECT x.id,e.full_name,x.kind,x.starts_on::text,x.ends_on::text,x.notes
    FROM office_employee_events x JOIN office_employees e ON e.id=x.employee_id
    WHERE x.office_id=$1 ORDER BY x.starts_on DESC LIMIT 60`,[office]),
 ]);
 return {employees,payroll,events};
}
export async function createEmployee(db:Db,actor:string,office:string,value:Employee) {
 const v=employeeSchema.parse(value);
 return db.query(
  `INSERT INTO office_employees
   (id,office_id,created_by,full_name,cpf,job_title,employment_kind,hired_on,
    monthly_salary_cents,weekly_hours,notes)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
  [v.id,office,actor,v.fullName,v.cpf||null,v.jobTitle,v.employmentKind,
   v.hiredOn,v.monthlySalaryCents,v.weeklyHours,v.notes]);
}
export async function updateEmployee(db:Db,office:string,id:string,status:string,salary:number) {
 return db.query(
  `UPDATE office_employees SET status=$3,monthly_salary_cents=$4,updated_at=now()
   WHERE id=$1 AND office_id=$2 RETURNING id`,[id,office,status,salary]);
}
export async function createPayroll(db:Db,actor:string,office:string,value:Payroll) {
 const v=payrollSchema.parse(value);
 return db.query(
  `INSERT INTO office_payroll
   (id,office_id,employee_id,created_by,period,kind,base_cents,additions_cents,
    deductions_cents,employer_charges_cents,benefits_cents,due_on,notes)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
  [v.id,office,v.employeeId,actor,v.period,v.kind,v.baseCents,v.additionsCents,
   v.deductionsCents,v.employerChargesCents,v.benefitsCents,v.dueOn,v.notes]);
}
export async function closePayroll(db:Db,office:string,id:string) {
 return db.query(
  `UPDATE office_payroll SET status='fechada',updated_at=now()
   WHERE id=$1 AND office_id=$2 AND status='rascunho' RETURNING id`,[id,office]);
}
export async function markPayrollPaid(db:Db,office:string,id:string,paidOn:string) {
 return db.query(
  `UPDATE office_payroll SET paid_on=$3,updated_at=now()
   WHERE id=$1 AND office_id=$2 AND status='fechada' AND paid_on IS NULL RETURNING id`,
  [id,office,paidOn]);
}
export async function createPersonnelEvent(db:Db,actor:string,office:string,value:Event) {
 const v=eventSchema.parse(value);
 return db.query(
  `INSERT INTO office_employee_events
   (id,office_id,employee_id,created_by,kind,starts_on,ends_on,notes)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [v.id,office,v.employeeId,actor,v.kind,v.startsOn,v.endsOn,v.notes]);
}
