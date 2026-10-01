import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("P3/PR3: prazos — RLS", () => {
  it("só advogado com acesso ao caso ou admin do escritório veem o prazo", async () => {
    const db = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await db.exec(readFileSync(join(dir, file), "utf8"));
      }
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();
      const deadlineId = crypto.randomUUID();

      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-PRAZO', $2, 'citizen', $3,
         'submitted', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('lawyer', 'lawyer', $1, '123456', 'MA', now(), 'admin')`,
        [office],
      );
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('outro_advogado', 'lawyer', $1, '654321', 'MA', now(), 'admin')`,
        [office],
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );
      for (const lawyerId of ["lawyer", "outro_advogado"]) {
        await db.query(
          `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
           VALUES ($1, 'active', now() + interval '1 month', 'test', $1 || '-prazo')`,
          [lawyerId],
        );
      }

      await db.exec(
        "CREATE ROLE prazo_tester; GRANT SELECT, INSERT, UPDATE ON deadlines TO prazo_tester; SET ROLE prazo_tester",
      );

      // "lawyer" (responsável e com acesso ao caso) cria o prazo.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query(
        `INSERT INTO deadlines(id, case_id, due_date, type, counting_rule, assigned_to, created_by)
         VALUES ($1, $2, current_date + 10, 'recurso', 'business_days', 'lawyer', 'lawyer')`,
        [deadlineId, caseId],
      );
      expect((await db.query("SELECT id FROM deadlines")).rows).toEqual([{ id: deadlineId }]);

      // "outro_advogado" não tem atribuição neste caso: não vê o prazo.
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      expect((await db.query("SELECT id FROM deadlines")).rows).toHaveLength(0);
      await expect(
        db.query(
          "UPDATE deadlines SET status = 'done', done_at = now() WHERE id = $1",
          [deadlineId],
        ),
      ).resolves.not.toThrow(); // UPDATE sem WHERE visível afeta zero linhas, nunca lança

      // admin vê (está no mesmo escritório do caso), mesmo sem ser o responsável.
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      expect((await db.query("SELECT id FROM deadlines")).rows).toEqual([{ id: deadlineId }]);

      // o próprio responsável conclui.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query(
        "UPDATE deadlines SET status = 'done', done_at = now() WHERE id = $1",
        [deadlineId],
      );
      const concluido = await db.query<{ status: string }>(
        "SELECT status FROM deadlines WHERE id = $1",
        [deadlineId],
      );
      expect(concluido.rows).toEqual([{ status: "done" }]);
    } finally {
      await db.close();
    }
  });

  it("escalonamento (job de manutenção) marca 'missed' só o que já venceu e está aberto", async () => {
    const db = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await db.exec(readFileSync(join(dir, file), "utf8"));
      }
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();
      const vencido = crypto.randomUUID();
      const futuro = crypto.randomUUID();
      const jaConcluido = crypto.randomUUID();

      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-ESC', $2, 'citizen', $3,
         'submitted', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query(
        `INSERT INTO deadlines(id, case_id, due_date, type, counting_rule, assigned_to, created_by, status)
         VALUES ($1, $2, current_date - 2, 'vencido', 'calendar_days', 'admin', 'admin', 'open')`,
        [vencido, caseId],
      );
      await db.query(
        `INSERT INTO deadlines(id, case_id, due_date, type, counting_rule, assigned_to, created_by, status)
         VALUES ($1, $2, current_date + 5, 'futuro', 'calendar_days', 'admin', 'admin', 'open')`,
        [futuro, caseId],
      );
      await db.query(
        `INSERT INTO deadlines(id, case_id, due_date, type, counting_rule, assigned_to, created_by, status, done_at)
         VALUES ($1, $2, current_date - 2, 'já concluído antes de vencer', 'calendar_days', 'admin', 'admin', 'done', now())`,
        [jaConcluido, caseId],
      );

      // Job de manutenção: mesma query de escalonarPrazosVencidos(), direto como dono (sem RLS).
      const escalados = await db.query<{ id: string }>(
        `UPDATE deadlines SET status = 'missed', escalated_at = now()
         WHERE status = 'open' AND due_date < current_date
         RETURNING id`,
      );
      expect(escalados.rows).toEqual([{ id: vencido }]);

      const status = await db.query<{ id: string; status: string }>(
        "SELECT id, status FROM deadlines ORDER BY id",
      );
      const porId = new Map(status.rows.map((r) => [r.id, r.status]));
      expect(porId.get(vencido)).toBe("missed");
      expect(porId.get(futuro)).toBe("open");
      expect(porId.get(jaConcluido)).toBe("done"); // nunca reabre o que já foi concluído
    } finally {
      await db.close();
    }
  });
});
