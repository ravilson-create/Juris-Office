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

describe("P8/PR8: gestão de equipe — RLS e invariantes", () => {
  it("promove, rebaixa e remove — sempre restrito a admin do mesmo escritório, nunca ao ponto de ficar sem nenhum admin", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const otherOffice = crypto.randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        otherOffice,
      ]);
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('lawyer', 'lawyer', $1)",
        [office],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin_outro', 'admin', $1)",
        [otherOffice],
      );
      const caseId = crypto.randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-EQUIPE', $2, 'citizen', $3,
         'in_negotiation', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );

      await db.exec(
        `CREATE ROLE equipe_tester;
         GRANT SELECT, UPDATE, DELETE ON profiles, case_assignments TO equipe_tester;
         GRANT EXECUTE ON FUNCTION promote_to_admin(text), demote_to_lawyer(text),
           remove_from_office(text) TO equipe_tester;
         SET ROLE equipe_tester`,
      );

      // admin de outro escritório não promove alguém daqui (a função só atualiza linhas do
      // próprio escritório do ator; aqui dá zero linhas afetadas, nunca lança).
      await db.query("SELECT set_config('app.user_id', 'admin_outro', false)");
      await db.query("SELECT promote_to_admin('lawyer')");

      // confirmado pelo admin do escritório certo: nada mudou.
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      expect(
        (await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = 'lawyer'"))
          .rows,
      ).toEqual([{ role: "lawyer" }]);

      // admin do escritório promove o advogado a admin.
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      await db.query("SELECT promote_to_admin('lawyer')");
      expect(
        (await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = 'lawyer'"))
          .rows,
      ).toEqual([{ role: "admin" }]);

      // com dois admins, rebaixar um funciona.
      await db.query("SELECT demote_to_lawyer('lawyer')");
      expect(
        (await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = 'lawyer'"))
          .rows,
      ).toEqual([{ role: "lawyer" }]);

      // mas rebaixar o último admin do escritório é rejeitado.
      await expect(db.query("SELECT demote_to_lawyer('admin')")).rejects.toThrow();

      // remover da equipe libera o caso e devolve a pessoa a 'citizen' sem escritório — sem
      // escritório, nem admin_office_profiles nem profile_self (de outro ator) a alcança mais,
      // então a conferência final é feita como dono (fora da RLS), só para checar o resultado.
      await db.query("SELECT remove_from_office('lawyer')");
      await db.exec("RESET ROLE");
      const removido = await db.query<{ role: string; office_id: string | null }>(
        "SELECT role, office_id FROM profiles WHERE user_id = 'lawyer'",
      );
      expect(removido.rows).toEqual([{ role: "citizen", office_id: null }]);
      expect(
        (await db.query("SELECT 1 FROM case_assignments WHERE lawyer_id = 'lawyer'")).rows,
      ).toHaveLength(0);
      await db.exec("SET ROLE equipe_tester");
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      // e remover o único admin restante também é rejeitado.
      await expect(db.query("SELECT remove_from_office('admin')")).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
