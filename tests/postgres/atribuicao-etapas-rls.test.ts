import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";
import { STATUS_PROFISSIONAL } from "@/domain/case/status";
vi.mock("server-only", () => ({}));
const { atribuirAdvogado } = await import("@/lib/services/equipe-atribuicao");
const db = new PGlite();
const wrap: Db = {
  query: async <T>(sql: string, p?: unknown[]) => (await db.query(sql, p)).rows as T[],
  transaction: async <T>(fn: (tx: Queryable) => Promise<T>) =>
    db.transaction((tx) =>
      fn({ query: async <R>(sql: string, p?: unknown[]) => (await tx.query(sql, p)).rows as R[] }),
    ),
};
const office = "00000000-0000-4000-8000-000000000001",
  otherOffice = crypto.randomUUID();
const cases = new Map<string, string>();
const draft = crypto.randomUUID();
const actor = (id: string) => db.query("SELECT set_config('app.user_id',$1,false)", [id]);
const directInsert = (caseId: string, lawyer: string, ofc = office) =>
  db.query("INSERT INTO case_assignments(case_id,lawyer_id,office_id) VALUES ($1,$2,$3)", [
    caseId,
    lawyer,
    ofc,
  ]);

describe("atribuição em todas as etapas profissionais, preservando RLS", () => {
  beforeAll(async () => {
    for (const f of readdirSync("db/migrations")
      .filter((f) => /^\d+_.*\.sql$/.test(f) && !f.startsWith("0039_"))
      .sort())
      await db.exec(readFileSync(join("db/migrations", f), "utf8"));
    await db.query("INSERT INTO offices(id,name) VALUES ($1,'Outro escritório')", [otherOffice]);
    await db.query(
      `INSERT INTO profiles(user_id,role,office_id,oab_verificado_em) VALUES
      ('assign-admin','admin',$1,NULL),('assign-lawyer','lawyer',$1,now()),('assign-lawyer2','lawyer',$1,now()),
      ('assign-no-oab','lawyer',$1,NULL),('assign-staff','staff',$1,NULL),
      ('assign-other-admin','admin',$2,NULL),('assign-other-lawyer','lawyer',$2,now())`,
      [office, otherOffice],
    );
    await db.query(
      "INSERT INTO lawyer_subscriptions(lawyer_id,status,valid_until,provider) VALUES ('assign-admin','active',now()+interval '1 year','test')",
    );
    for (const status of STATUS_PROFISSIONAL) {
      const id = crypto.randomUUID();
      cases.set(status, id);
      await db.query(
        `INSERT INTO legal_cases(id,protocol,legal_area_id,office_id,status,submitted_at,created_at,updated_at) VALUES ($1::uuid,$1::text,$2,$3,$4,now(),now(),now())`,
        [id, crypto.randomUUID(), office, status],
      );
    }
    await db.query(
      `INSERT INTO legal_cases(id,protocol,legal_area_id,office_id,status,created_at,updated_at) VALUES ($1::uuid,$1::text,$2,$3,'draft',now(),now())`,
      [draft, crypto.randomUUID(), office],
    );
    await db.exec(`CREATE ROLE assignment_tester; GRANT SELECT ON profiles,legal_cases,audit_logs TO assignment_tester;
      GRANT SELECT,INSERT ON case_assignments TO assignment_tester; GRANT INSERT ON audit_logs TO assignment_tester;
      GRANT USAGE ON SEQUENCE audit_logs_id_seq TO assignment_tester; SET ROLE assignment_tester`);
    await actor("assign-admin");
  }, 60000);
  afterAll(async () => {
    await db.close();
  });
  it("reproduz a recusa anterior em análise e a corrige com a migração", async () => {
    const id = cases.get("under_legal_review")!;
    await expect(atribuirAdvogado(wrap, "assign-admin", id, "assign-lawyer")).rejects.toThrow(
      /row-level security/,
    );
    await db.exec("RESET ROLE");
    await db.exec(readFileSync("db/migrations/0039_atribuicao_etapas_profissionais.sql", "utf8"));
    await db.exec("SET ROLE assignment_tester");
    expect(await atribuirAdvogado(wrap, "assign-admin", id, "assign-lawyer")).toBe("ok");
  });
  it("aceita as oito etapas da fila, mantém atribuições e auditoria sem duplicações", async () => {
    for (const status of STATUS_PROFISSIONAL) {
      const id = cases.get(status)!;
      expect(["ok", "existente"]).toContain(
        await atribuirAdvogado(wrap, "assign-admin", id, "assign-lawyer"),
      );
      expect(await atribuirAdvogado(wrap, "assign-admin", id, "assign-lawyer")).toBe("existente");
      expect(
        (
          await db.query("SELECT * FROM audit_logs WHERE case_id=$1 AND action='assign_lawyer'", [
            id,
          ])
        ).rows,
      ).toHaveLength(1);
    }
    const id = cases.get("accepted")!;
    expect(await atribuirAdvogado(wrap, "assign-admin", id, "assign-lawyer2")).toBe("ok");
    expect(
      (await db.query("SELECT * FROM case_assignments WHERE case_id=$1", [id])).rows,
    ).toHaveLength(2);
  });
  it("nega rascunhos, advogado de outro escritório ou sem OAB", async () => {
    expect(await atribuirAdvogado(wrap, "assign-admin", draft, "assign-lawyer")).toBe(
      "indisponivel",
    );
    await expect(directInsert(draft, "assign-lawyer")).rejects.toThrow(/row-level security/);
    for (const lawyer of ["assign-other-lawyer", "assign-no-oab"])
      await expect(
        atribuirAdvogado(wrap, "assign-admin", cases.get("accepted")!, lawyer),
      ).rejects.toThrow(/row-level security/);
  });
  it("nega atribuição por staff, advogado e administrador de outro escritório", async () => {
    for (const user of ["assign-staff", "assign-lawyer"]) {
      await actor(user);
      await expect(directInsert(cases.get("active")!, "assign-lawyer2")).rejects.toThrow(
        /row-level security/,
      );
    }
    await actor("assign-other-admin");
    expect(
      await atribuirAdvogado(
        wrap,
        "assign-other-admin",
        cases.get("accepted")!,
        "assign-other-lawyer",
      ),
    ).toBe("indisponivel");
    await expect(
      directInsert(cases.get("active")!, "assign-other-lawyer", otherOffice),
    ).rejects.toThrow(/row-level security/);
    await actor("assign-admin");
  });
  it("continua exigindo assinatura ativa do escritório", async () => {
    await db.exec(
      "RESET ROLE; UPDATE offices SET internal_access=false WHERE id='00000000-0000-4000-8000-000000000001'; UPDATE lawyer_subscriptions SET status='canceled' WHERE lawyer_id='assign-admin'; SET ROLE assignment_tester",
    );
    await actor("assign-admin");
    await expect(directInsert(cases.get("active")!, "assign-lawyer2")).rejects.toThrow(
      /row-level security/,
    );
  });
});
