import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const db=new PGlite();
const own="00000000-0000-4000-8000-000000000009";
const other="00000000-0000-4000-8000-000000000008";
const id=crypto.randomUUID();
const actor=async (name:string)=>db.query("SELECT set_config('app.user_id',$1,false)",[name]);

describe("Pessoal: RLS e imutabilidade da folha",()=>{
 beforeAll(async()=>{
  for(const file of readdirSync("db/migrations").filter(x=>/^\d+_.+\.sql$/.test(x)).sort())
   await db.exec(readFileSync(join("db/migrations",file),"utf8"));
  await db.query("INSERT INTO offices(id,name) VALUES ($1,'Escritório folha'),($2,'Outro escritório')",[own,other]);
  await db.query(`INSERT INTO profiles(user_id,role,office_id) VALUES
   ('rh-admin','admin',$1),('rh-staff','staff',$1),('rh-lawyer','lawyer',$1),('rh-other','admin',$2)`,[own,other]);
  await db.exec(`INSERT INTO lawyer_subscriptions(lawyer_id,status,valid_until,provider) VALUES
   ('rh-admin','active',now()+interval '1 year','test'),('rh-other','active',now()+interval '1 year','test');
   CREATE ROLE rh_tester;
   GRANT SELECT,INSERT,UPDATE ON office_employees,office_payroll TO rh_tester;
   GRANT SELECT,INSERT ON office_employee_events TO rh_tester;
   GRANT SELECT ON profiles,offices TO rh_tester;
   GRANT INSERT ON audit_logs TO rh_tester;
   GRANT USAGE ON SEQUENCE audit_logs_id_seq TO rh_tester;
   SET ROLE rh_tester;`);
 },60000);
 afterAll(async()=>db.close());
 it("administrador cadastra e outros perfis não veem dados nem salários",async()=>{
  await actor("rh-admin");
  await db.query(`INSERT INTO office_employees(id,office_id,created_by,full_name,job_title,
   employment_kind,hired_on,monthly_salary_cents,weekly_hours)
   VALUES ($1,$2,'rh-admin','Maria Silva','Assistente','clt','2026-10-01',250000,44)`,[id,own]);
  for(const who of ["rh-staff","rh-lawyer","rh-other",""]){
   await actor(who);
   expect((await db.query("SELECT * FROM office_employees")).rows).toHaveLength(0);
   await expect(db.query(`INSERT INTO office_payroll(id,office_id,employee_id,created_by,period,kind,
    base_cents,due_on) VALUES($1,$2,$3,$4,'2026-10-01','mensal',250000,'2026-10-31')`,
    [crypto.randomUUID(),own,id,who])).rejects.toThrow();
  }
 });
 it("não permite vincular empregado de outro escritório ou reabrir folha fechada",async()=>{
  await actor("rh-admin");
  const payrollId=crypto.randomUUID();
  await db.query(`INSERT INTO office_payroll(id,office_id,employee_id,created_by,period,kind,
   base_cents,due_on) VALUES($1,$2,$3,'rh-admin','2026-10-01','mensal',250000,'2026-10-31')`,
   [payrollId,own,id]);
  await db.query("UPDATE office_payroll SET status='fechada' WHERE id=$1",[payrollId]);
  await expect(db.query("UPDATE office_payroll SET base_cents=1 WHERE id=$1",[payrollId])).rejects.toThrow();
  await expect(db.query("UPDATE office_payroll SET status='rascunho' WHERE id=$1",[payrollId])).rejects.toThrow();
  await db.query("UPDATE office_payroll SET paid_on='2026-10-01' WHERE id=$1",[payrollId]);
  await expect(db.query("UPDATE office_payroll SET paid_on='2026-10-02' WHERE id=$1",[payrollId])).rejects.toThrow();
 });
});
