import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("cadastro administrativo confirma apenas a identidade correspondente e recusa falsificação", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA neon_auth;
      CREATE TABLE neon_auth."user" (
        id uuid PRIMARY KEY, name text, email text UNIQUE,
        "emailVerified" boolean DEFAULT false,
        "createdAt" timestamptz, "updatedAt" timestamptz
      );
      CREATE TABLE neon_auth.account (
        id uuid PRIMARY KEY, "accountId" text, "providerId" text,
        "userId" uuid REFERENCES neon_auth."user"(id),
        "createdAt" timestamptz, "updatedAt" timestamptz
      );
    `);
    const dir = join(process.cwd(), "db/migrations");
    for (const file of readdirSync(dir).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      await db.exec(readFileSync(join(dir, file), "utf8"));
    }
    await expect(db.exec("DO $test$\nDECLARE office uuid := gen_random_uuid(); other_office uuid := gen_random_uuid();\n  admin_id text := gen_random_uuid()::text; outsider text := gen_random_uuid()::text;\n  member_id uuid := gen_random_uuid(); mismatch_id uuid := gen_random_uuid();\nBEGIN\n  BEGIN\n    INSERT INTO public.offices(id,name) VALUES (office,'Teste isolado'),(other_office,'Outro teste');\n    INSERT INTO public.profiles(user_id,role,office_id) VALUES\n      (admin_id,'admin',office),(outsider,'admin',other_office);\n    INSERT INTO neon_auth.\"user\"(id,name,email,\"emailVerified\",\"createdAt\",\"updatedAt\") VALUES\n      (member_id,'Teste','team-fix-'||member_id||'@example.test',false,now(),now()),\n      (mismatch_id,'Outro','team-fix-'||mismatch_id||'@example.test',false,now(),now());\n    INSERT INTO neon_auth.account(id,\"accountId\",\"providerId\",\"userId\",\"createdAt\",\"updatedAt\") VALUES\n      (gen_random_uuid(),member_id::text,'credential',member_id,now(),now()),\n      (gen_random_uuid(),mismatch_id::text,'credential',mismatch_id,now(),now());\n    PERFORM set_config('app.user_id',admin_id,true);\n    PERFORM public.cadastrar_membro_equipe_direto(member_id::text,'team-fix-'||member_id||'@example.test','staff','12345678901',NULL,NULL);\n    IF NOT (SELECT \"emailVerified\" FROM neon_auth.\"user\" WHERE id=member_id) THEN\n      RAISE EXCEPTION 'registro administrativo não liberou identidade';\n    END IF;\n    BEGIN\n      PERFORM public.cadastrar_membro_equipe_direto(mismatch_id::text,'outro@example.test','staff','12345678901',NULL,NULL);\n      RAISE EXCEPTION USING ERRCODE='ZX002', MESSAGE='e-mail divergente foi aceito';\n    EXCEPTION WHEN raise_exception THEN NULL;\n    END;\n    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id=mismatch_id::text) OR\n      (SELECT \"emailVerified\" FROM neon_auth.\"user\" WHERE id=mismatch_id) THEN\n      RAISE EXCEPTION 'falha deixou registro parcial';\n    END IF;\n    PERFORM set_config('app.user_id',outsider,true);\n    BEGIN\n      INSERT INTO public.audit_logs(actor_id,action) VALUES\n        (admin_id,'cadastrar_membro_equipe_direto:'||mismatch_id);\n      RAISE EXCEPTION USING ERRCODE='ZX002', MESSAGE='ator falsificado foi aceito';\n    EXCEPTION WHEN raise_exception THEN NULL;\n    END;\n    IF (SELECT \"emailVerified\" FROM neon_auth.\"user\" WHERE id=mismatch_id) THEN\n      RAISE EXCEPTION 'identidade pública foi liberada';\n    END IF;\n    RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='testes aprovados; desfazendo fixtures';\n  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;\n  END;\nEND $test$")).resolves.toBeDefined();
    expect((await db.query('SELECT id FROM neon_auth."user"')).rows).toHaveLength(0);
  } finally {
    await db.close();
  }
});
