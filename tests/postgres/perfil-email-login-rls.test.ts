import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("sincronização de e-mail no login com RLS", () => {
  it("reproduz a falha e permite apenas e-mail próprio, preservando papel e escritório", async () => {
    const db = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const f of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f) && !f.startsWith("0038_"))
        .sort()) {
        await db.exec(readFileSync(join(dir, f), "utf8"));
      }
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query(
        `INSERT INTO profiles(user_id,role,office_id,email) VALUES
        ('login-admin','admin',$1,'admin@example.test'),('login-lawyer','lawyer',$1,'lawyer@example.test'),
        ('login-staff','staff',$1,'staff@example.test'),('login-citizen','citizen',NULL,'citizen@example.test')`,
        [office],
      );
      await db.exec(`CREATE ROLE juris_runtime;
        GRANT SELECT,INSERT,UPDATE ON profiles TO juris_runtime;
        SET ROLE juris_runtime`);
      await db.query("SELECT set_config('app.user_id','login-admin',false)");
      const upsert = `INSERT INTO profiles(user_id,role,email) VALUES ($1,'citizen',$2)
        ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email`;
      await expect(db.query(upsert, ["login-admin", "admin@example.test"])).rejects.toThrow(
        /row-level security/,
      );
      await db.exec("RESET ROLE");
      await db.exec(readFileSync(join(dir, "0038_perfil_email_login_rls.sql"), "utf8"));
      await db.exec("SET ROLE juris_runtime");
      for (const [id, role] of [
        ["login-admin", "admin"],
        ["login-lawyer", "lawyer"],
        ["login-staff", "staff"],
        ["login-citizen", "citizen"],
      ]) {
        await db.query("SELECT set_config('app.user_id',$1,false)", [id]);
        await db.query(upsert, [id, `${id}@example.test`]);
        const p = (
          await db.query<{ role: string; office_id: string | null; email: string }>(
            "SELECT role,office_id,email FROM profiles WHERE user_id=$1",
            [id],
          )
        ).rows[0];
        expect(p.role).toBe(role);
        expect(p.office_id).toBe(role === "citizen" ? null : office);
        expect(p.email).toBe(`${id}@example.test`);
        await expect(
          db.query("UPDATE profiles SET role='admin' WHERE user_id=$1", [id]),
        ).rejects.toThrow(/permission denied/);
        await expect(
          db.query("UPDATE profiles SET office_id=NULL WHERE user_id=$1", [id]),
        ).rejects.toThrow(/permission denied/);
      }
      await db.query("SELECT set_config('app.user_id','login-lawyer',false)");
      expect(
        (
          await db.query(
            "UPDATE profiles SET email='outro@example.test' WHERE user_id='login-admin' RETURNING user_id",
          )
        ).rows,
      ).toHaveLength(0);
      await expect(db.query(upsert, ["login-admin", "outro@example.test"])).rejects.toThrow();
      await db.query("SELECT set_config('app.user_id','login-new',false)");
      await db.query(upsert, ["login-new", "new@example.test"]);
      expect(
        (await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id='login-new'"))
          .rows[0].role,
      ).toBe("citizen");
    } finally {
      await db.close();
    }
  }, 30000);
});
