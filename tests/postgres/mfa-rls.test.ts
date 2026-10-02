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

describe("P7/PR7: MFA — RLS", () => {
  it("cada advogado só lê e grava o próprio segredo; nem admin do mesmo escritório vê o de outro", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('lawyer', 'lawyer', $1)",
        [office],
      );

      await db.exec(
        `CREATE ROLE mfa_tester;
         GRANT SELECT ON profile_mfa TO mfa_tester;
         GRANT EXECUTE ON FUNCTION enroll_own_mfa(text), confirm_own_mfa(text[]),
           disable_own_mfa(), consume_own_mfa_backup_code(text) TO mfa_tester;
         SET ROLE mfa_tester`,
      );

      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query("SELECT enroll_own_mfa('SEGREDOTESTE')");
      const pendente = await db.query<{ secret: string; enabled_at: string | null }>(
        "SELECT secret, enabled_at FROM profile_mfa WHERE user_id = 'lawyer'",
      );
      expect(pendente.rows).toEqual([{ secret: "SEGREDOTESTE", enabled_at: null }]);

      // admin do mesmo escritório não enxerga o segredo do advogado.
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      expect(
        (await db.query("SELECT secret FROM profile_mfa WHERE user_id = 'lawyer'")).rows,
      ).toHaveLength(0);

      // confirmação liga o MFA e grava os códigos de backup (já como hash, responsabilidade do
      // chamador — a função só grava o que recebe).
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query("SELECT confirm_own_mfa($1)", [["hash1", "hash2"]]);
      const ativo = await db.query<{ enabled_at: string | null; backup_codes: string[] }>(
        "SELECT enabled_at, backup_codes FROM profile_mfa WHERE user_id = 'lawyer'",
      );
      expect(ativo.rows[0]?.enabled_at).not.toBeNull();
      expect(ativo.rows[0]?.backup_codes).toEqual(["hash1", "hash2"]);

      // um código de backup só funciona uma vez.
      const primeiraVez = await db.query<{ consume_own_mfa_backup_code: boolean }>(
        "SELECT consume_own_mfa_backup_code('hash1')",
      );
      expect(primeiraVez.rows[0]?.consume_own_mfa_backup_code).toBe(true);
      const segundaVez = await db.query<{ consume_own_mfa_backup_code: boolean }>(
        "SELECT consume_own_mfa_backup_code('hash1')",
      );
      expect(segundaVez.rows[0]?.consume_own_mfa_backup_code).toBe(false);

      // desativar apaga o registro inteiro.
      await db.query("SELECT disable_own_mfa()");
      expect(
        (await db.query("SELECT 1 FROM profile_mfa WHERE user_id = 'lawyer'")).rows,
      ).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
});
