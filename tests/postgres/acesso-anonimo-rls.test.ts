import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

async function migrarBancoNovo(): Promise<PGlite> {
  const db = new PGlite();
  const dir = join(process.cwd(), "db/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

const AREA = "11111111-1111-4111-8111-111111111111";
// owner_session_hash exige o formato de um sha256 em hex (64 caracteres) — ver 0001_atendimentos.sql.
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

describe("P3: atendimento anônimo continua acessível com a Neon Auth configurada", () => {
  it("cria, lê e atualiza um caso só com app.anon_hash (sem login)", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.exec(
        "CREATE ROLE p3_anon; GRANT SELECT, INSERT, UPDATE ON legal_cases TO p3_anon; SET ROLE p3_anon",
      );
      await db.query("SELECT set_config('app.user_id', '', false)");
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [HASH_A]);

      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, created_at, updated_at)
         VALUES ($1, 'JO-ANON-1', $2, $3, 'draft', now(), now())`,
        [caseId, AREA, HASH_A],
      );
      expect((await db.query("SELECT id FROM legal_cases")).rows).toEqual([{ id: caseId }]);

      await db.query("UPDATE legal_cases SET title = 'meu caso' WHERE id = $1", [caseId]);
      const [row] = (
        await db.query<{ title: string }>("SELECT title FROM legal_cases WHERE id = $1", [caseId])
      ).rows;
      expect(row.title).toBe("meu caso");
    } finally {
      await db.close();
    }
  });

  it("um navegador anônimo não enxerga o caso de outro", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.exec(
        "CREATE ROLE p3_anon2; GRANT SELECT, INSERT ON legal_cases TO p3_anon2; SET ROLE p3_anon2",
      );
      await db.query("SELECT set_config('app.user_id', '', false)");
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [HASH_A]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, created_at, updated_at)
         VALUES ($1, 'JO-ANON-A', $2, $3, 'draft', now(), now())`,
        [randomUUID(), AREA, HASH_A],
      );
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [HASH_B]);
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("sem app.user_id nem app.anon_hash, nenhum caso aparece", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.exec(
        "CREATE ROLE p3_anon3; GRANT SELECT, INSERT ON legal_cases TO p3_anon3; SET ROLE p3_anon3",
      );
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [HASH_C]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, created_at, updated_at)
         VALUES ($1, 'JO-ANON-C', $2, $3, 'draft', now(), now())`,
        [randomUUID(), AREA, HASH_C],
      );
      await db.query("SELECT set_config('app.user_id', '', false)");
      await db.query("SELECT set_config('app.anon_hash', '', false)");
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
});
