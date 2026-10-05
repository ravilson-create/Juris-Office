import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("P2: isolamento por identidade verificada no banco", () => {
  it("mantém notas profissionais invisíveis ao cidadão e revoga acesso sem assinatura", async () => {
    const db = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await db.exec(readFileSync(join(dir, file), "utf8"));
      }
      const caseId = crypto.randomUUID();
      const noteId = crypto.randomUUID();
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, status,
           submitted_at, created_at, updated_at) VALUES($1, 'JO-NOTE', $2, 'citizen',
           'submitted', now(), now(), now())`,
        [caseId, crypto.randomUUID()],
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
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );
      // A assinatura agora é do escritório (quem paga é o admin), não do advogado individual.
      await db.query(`INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
        VALUES ('admin', 'active', now() + interval '1 month', 'test', 'note-paid')`);
      await db.query(
        "INSERT INTO case_notes(id, case_id, author_id, body) VALUES ($1, $2, 'lawyer', 'Nota privada')",
        [noteId, caseId],
      );
      await db.exec(
        "CREATE ROLE note_reader; GRANT SELECT ON case_notes TO note_reader; SET ROLE note_reader",
      );
      await db.query("SELECT set_config('app.user_id', 'citizen', false)");
      expect((await db.query("SELECT id FROM case_notes")).rows).toHaveLength(0);
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect((await db.query("SELECT id FROM case_notes")).rows).toEqual([{ id: noteId }]);
      await db.exec(
        "RESET ROLE; UPDATE lawyer_subscriptions SET status = 'canceled' WHERE lawyer_id = 'admin'; SET ROLE note_reader",
      );
      expect((await db.query("SELECT id FROM case_notes")).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
  it("advogado só vê casos atribuídos e administrador só os do escritório", async () => {
    const db = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await db.exec(readFileSync(join(dir, file), "utf8"));
      }
      const office = "00000000-0000-4000-8000-000000000001";
      const otherOffice = crypto.randomUUID();
      const assigned = crypto.randomUUID();
      const unassigned = crypto.randomUUID();
      const elsewhere = crypto.randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        otherOffice,
      ]);
      for (const [id, officeId] of [
        [assigned, office],
        [unassigned, office],
        [elsewhere, otherOffice],
      ]) {
        await db.query(
          `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
          status, submitted_at, created_at, updated_at) VALUES ($1, $2, $3, 'citizen', $4,
          'submitted', now(), now(), now())`,
          [id, id, crypto.randomUUID(), officeId],
        );
      }
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('lawyer', 'lawyer', $1, '123456', 'MA', now(), 'admin')`,
        [office],
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [assigned, office],
      );
      // A assinatura agora é do escritório (quem paga é o admin), não do advogado individual.
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('admin', 'active', now() + interval '1 month', 'test', 'test-paid')`,
      );
      await db.exec(
        "CREATE ROLE p2_staff; GRANT SELECT ON legal_cases TO p2_staff; SET ROLE p2_staff",
      );
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect((await db.query("SELECT id FROM legal_cases")).rows).toEqual([{ id: assigned }]);
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      expect(
        (await db.query<{ id: string }>("SELECT id FROM legal_cases ORDER BY id")).rows.map(
          (r) => r.id,
        ),
      ).toEqual([assigned, unassigned].sort());
      await db.exec(
        "RESET ROLE; GRANT SELECT ON profiles TO p2_staff; GRANT INSERT, SELECT ON case_assignments TO p2_staff; SET ROLE p2_staff",
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [unassigned, office],
      );
      await expect(
        db.query(
          "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
          [elsewhere, otherOffice],
        ),
      ).rejects.toThrow();
      await db.exec(
        "RESET ROLE; UPDATE lawyer_subscriptions SET status = 'canceled' WHERE lawyer_id = 'admin'; SET ROLE p2_staff",
      );
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
  it("nega leitura cruzada e gravação com identidade de outra pessoa", async () => {
    const db = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await db.exec(readFileSync(join(dir, file), "utf8"));
      }
      const caseId = crypto.randomUUID();
      const areaId = crypto.randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, status, created_at, updated_at)
         VALUES($1, 'JO-TEST-P2', $2, 'citizen-a', 'draft', now(), now())`,
        [caseId, areaId],
      );
      await db.exec(
        "CREATE ROLE p2_app; GRANT SELECT, INSERT, UPDATE ON legal_cases TO p2_app; SET ROLE p2_app",
      );
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
      await db.query("SELECT set_config('app.user_id', $1, false)", ["citizen-b"]);
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
      await expect(
        db.query("UPDATE legal_cases SET title = 'invadido' WHERE id = $1 RETURNING id", [caseId]),
      ).resolves.toMatchObject({ rows: [] });
      await expect(
        db.query(
          `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, status, created_at, updated_at)
         VALUES($1, 'JO-TEST-B', $2, 'citizen-a', 'draft', now(), now())`,
          [crypto.randomUUID(), areaId],
        ),
      ).rejects.toThrow();
      await db.query("SELECT set_config('app.user_id', $1, false)", ["citizen-a"]);
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(1);
    } finally {
      await db.close();
    }
  });
});
