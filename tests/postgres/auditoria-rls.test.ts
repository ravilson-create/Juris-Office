import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

async function migrar(db: PGlite) {
  const dir = join(process.cwd(), "db/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
}

describe("P6/PR6: auditoria de leitura — RLS", () => {
  it("cada ator vê a própria trilha; admin vê também a do escritório; outro advogado não vê nada disso", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const otherOffice = crypto.randomUUID();
      const caseId = crypto.randomUUID();
      const caseOutroEscritorio = crypto.randomUUID();

      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        otherOffice,
      ]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-AUD', $2, 'citizen', $3,
         'under_legal_review', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-AUD2', $2, 'citizen', $3,
         'under_legal_review', now(), now(), now())`,
        [caseOutroEscritorio, crypto.randomUUID(), otherOffice],
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
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('lawyer', 'active', now() + interval '1 month', 'test', 'aud-paid')`,
      );

      await db.exec(
        "CREATE ROLE audit_tester; GRANT SELECT, INSERT ON audit_logs TO audit_tester; SET ROLE audit_tester",
      );

      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query("INSERT INTO audit_logs(actor_id, case_id, action) VALUES ('lawyer', $1, 'read_case')", [
        caseId,
      ]);

      // "lawyer" vê a própria entrada.
      expect(
        (await db.query<{ action: string }>("SELECT action FROM audit_logs WHERE case_id = $1", [
          caseId,
        ])).rows,
      ).toEqual([{ action: "read_case" }]);

      // "outro_advogado" não tem acesso a este caso: não vê a trilha, mesmo sendo advogado.
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      expect(
        (await db.query("SELECT action FROM audit_logs WHERE case_id = $1", [caseId])).rows,
      ).toHaveLength(0);

      // admin do mesmo escritório vê a trilha do caso, mesmo sem ser o ator.
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      expect(
        (await db.query<{ actor_id: string }>("SELECT actor_id FROM audit_logs WHERE case_id = $1", [
          caseId,
        ])).rows,
      ).toEqual([{ actor_id: "lawyer" }]);

      // mas não vê a trilha de um caso de outro escritório (gravada aqui como dono, fora da RLS,
      // só para existir uma linha a testar).
      await db.exec("RESET ROLE");
      await db.query(
        "INSERT INTO audit_logs(actor_id, case_id, action) VALUES ('alguem', $1, 'read_case')",
        [caseOutroEscritorio],
      );
      await db.exec("SET ROLE audit_tester");
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      expect(
        (await db.query("SELECT action FROM audit_logs WHERE case_id = $1", [caseOutroEscritorio]))
          .rows,
      ).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
});
