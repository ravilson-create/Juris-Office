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
const HASH_DONO = "a".repeat(64);

describe("Arquivar atendimento — RLS (migração 0018)", () => {
  it("cidadão arquiva e desarquiva mesmo um atendimento já ativo (sem política nova, UPDATE já cobre)", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, created_at, updated_at)
         VALUES ($1, 'JO-ARQ-1', $2, $3, 'active', now(), now())`,
        [caseId, AREA, HASH_DONO],
      );

      await db.exec(
        "CREATE ROLE arq_cidadao; GRANT SELECT, UPDATE ON legal_cases TO arq_cidadao; SET ROLE arq_cidadao",
      );
      await db.query("SELECT set_config('app.user_id', '', false)");
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [HASH_DONO]);

      await db.query("UPDATE legal_cases SET archived_at = now() WHERE id = $1", [caseId]);
      const [arquivado] = (
        await db.query<{ archived_at: string | null }>(
          "SELECT archived_at FROM legal_cases WHERE id = $1",
          [caseId],
        )
      ).rows;
      expect(arquivado.archived_at).not.toBeNull();

      await db.query("UPDATE legal_cases SET archived_at = NULL WHERE id = $1", [caseId]);
      const [desarquivado] = (
        await db.query<{ archived_at: string | null }>(
          "SELECT archived_at FROM legal_cases WHERE id = $1",
          [caseId],
        )
      ).rows;
      expect(desarquivado.archived_at).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("um navegador que não é dono não consegue arquivar o caso de outro", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, created_at, updated_at)
         VALUES ($1, 'JO-ARQ-2', $2, $3, 'draft', now(), now())`,
        [caseId, AREA, HASH_DONO],
      );

      await db.exec(
        "CREATE ROLE arq_outro; GRANT SELECT, UPDATE ON legal_cases TO arq_outro; SET ROLE arq_outro",
      );
      await db.query("SELECT set_config('app.user_id', '', false)");
      await db.query("SELECT set_config('app.anon_hash', $1, false)", ["b".repeat(64)]);

      await db.query("UPDATE legal_cases SET archived_at = now() WHERE id = $1", [caseId]);

      await db.exec("RESET ROLE");
      const [row] = (
        await db.query<{ archived_at: string | null }>(
          "SELECT archived_at FROM legal_cases WHERE id = $1",
          [caseId],
        )
      ).rows;
      expect(row.archived_at).toBeNull();
    } finally {
      await db.close();
    }
  });
});
