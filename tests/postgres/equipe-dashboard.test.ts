import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

/**
 * As consultas do painel (lib/services/equipe-dashboard.ts) não filtram por advogado/escritório
 * no SQL — contam com a RLS de `legal_cases` para isso. Este teste prova que a contagem agregada
 * respeita o mesmo isolamento já provado linha a linha em p2-auth-rls.test.ts: advogado só conta
 * o que lhe foi atribuído, admin só conta o próprio escritório.
 */
describe("painel do advogado: contagens respeitam a RLS", () => {
  it("advogado só conta casos atribuídos a ele; admin conta todo o escritório", async () => {
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
      for (const [id, officeId, status] of [
        [assigned, office, "submitted"],
        [unassigned, office, "active"],
        [elsewhere, otherOffice, "submitted"],
      ]) {
        await db.query(
          `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
           status, submitted_at, created_at, updated_at) VALUES ($1, $2, $3, 'citizen', $4,
           $5, now(), now(), now())`,
          [id, id, crypto.randomUUID(), officeId, status],
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
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('lawyer', 'active', now() + interval '1 month', 'test', 'dash-test')`,
      );

      await db.exec(
        "CREATE ROLE dash_reader; GRANT SELECT ON legal_cases TO dash_reader; GRANT SELECT ON case_assignments TO dash_reader; SET ROLE dash_reader",
      );

      const statusProfissional = [
        "submitted",
        "under_legal_review",
        "needs_information",
        "accepted",
        "rejected",
        "in_negotiation",
        "active",
        "closed",
      ];

      // count(*) vem como number no PGlite e como string de bigint no Postgres real
      // (node-postgres) — este teste roda contra os dois drivers (projetos "postgres" e
      // "postgres-real"), então normaliza com Number() antes de comparar, exatamente como a
      // produção faz em resumirContagemPorStatus.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      const porStatusAdvogado = await db.query<{ status: string; count: string | number }>(
        "SELECT status, count(*) FROM legal_cases WHERE status = ANY($1) GROUP BY status",
        [statusProfissional],
      );
      expect(
        porStatusAdvogado.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      ).toEqual([{ status: "submitted", count: 1 }]);

      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      const porStatusAdmin = await db.query<{ status: string; count: string | number }>(
        "SELECT status, count(*) FROM legal_cases WHERE status = ANY($1) GROUP BY status ORDER BY status",
        [statusProfissional],
      );
      expect(
        porStatusAdmin.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      ).toEqual([
        { status: "active", count: 1 },
        { status: "submitted", count: 1 },
      ]);

      const semAdvogadoAdmin = await db.query<{ count: string | number }>(
        `SELECT count(*) FROM legal_cases c
         WHERE c.status = ANY($1) AND NOT EXISTS (
           SELECT 1 FROM case_assignments a WHERE a.case_id = c.id
         )`,
        [statusProfissional],
      );
      // só o "unassigned" conta; nunca o "elsewhere" (outro escritório)
      expect(Number(semAdvogadoAdmin.rows[0]?.count)).toBe(1);
    } finally {
      await db.close();
    }
  });
});
