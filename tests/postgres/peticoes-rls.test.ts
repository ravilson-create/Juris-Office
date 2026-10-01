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
const OFFICE = "00000000-0000-4000-8000-000000000001";

describe("P4: rascunho de petição é visível só a advogado/admin com acesso ao caso", () => {
  it("o cidadão dono do caso não enxerga a petição, mas o advogado atribuído sim", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id, status,
           submitted_at, created_at, updated_at) VALUES ($1, 'JO-PET-1', $2, 'citizen', $3,
           'submitted', now(), now(), now())`,
        [caseId, AREA, OFFICE],
      );
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin-pet', 'admin', $1)", [
        OFFICE,
      ]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('advogado-pet', 'lawyer', $1, '123456', 'MA', now(), 'admin-pet')`,
        [OFFICE],
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'advogado-pet', $2)",
        [caseId, OFFICE],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('advogado-pet', 'trial', now() + interval '7 days', 'asaas')`,
      );

      await db.exec(
        "CREATE ROLE pet_app; GRANT SELECT, INSERT ON case_petitions TO pet_app; SET ROLE pet_app",
      );
      const petitionId = randomUUID();
      await db.query("SELECT set_config('app.user_id', 'advogado-pet', false)");
      await db.query(
        `INSERT INTO case_petitions(id, case_id, modelo_id, titulo_modelo, secoes, criado_por)
         VALUES ($1, $2, 'familia.acao_alimentos', 'Ação de Alimentos', '[]'::jsonb, 'advogado-pet')`,
        [petitionId, caseId],
      );
      expect((await db.query("SELECT id FROM case_petitions")).rows).toEqual([{ id: petitionId }]);

      await db.query("SELECT set_config('app.user_id', 'citizen', false)");
      expect((await db.query("SELECT id FROM case_petitions")).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
});
