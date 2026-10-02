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

describe("Exclusão de atendimento e contrato — RLS (migração 0017)", () => {
  it("cidadão exclui o próprio atendimento antes de aceito, mas não depois", async () => {
    const db = await migrarBancoNovo();
    try {
      const antesDeAceito = randomUUID();
      const jaAceito = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, created_at, updated_at)
         VALUES ($1, 'JO-DEL-1', $2, $3, 'draft', now(), now())`,
        [antesDeAceito, AREA, HASH_DONO],
      );
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, created_at, updated_at)
         VALUES ($1, 'JO-DEL-2', $2, $3, 'active', now(), now())`,
        [jaAceito, AREA, HASH_DONO],
      );

      await db.exec(
        "CREATE ROLE del_cidadao; GRANT SELECT, DELETE ON legal_cases TO del_cidadao; SET ROLE del_cidadao",
      );
      await db.query("SELECT set_config('app.user_id', '', false)");
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [HASH_DONO]);

      const excluido = await db.query("DELETE FROM legal_cases WHERE id = $1 RETURNING id", [
        antesDeAceito,
      ]);
      expect(excluido.rows).toEqual([{ id: antesDeAceito }]);

      // Já aceito: a política nega, a linha continua lá (0 linhas afetadas, sem erro).
      const naoExcluido = await db.query("DELETE FROM legal_cases WHERE id = $1 RETURNING id", [
        jaAceito,
      ]);
      expect(naoExcluido.rows).toEqual([]);

      await db.exec("RESET ROLE");
      expect(
        (await db.query("SELECT id FROM legal_cases WHERE id = $1", [jaAceito])).rows,
      ).toHaveLength(1);
    } finally {
      await db.close();
    }
  });

  it("advogado com acesso exclui; advogado sem acesso ao caso não exclui", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = randomUUID();
      const caseId = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório')", [office]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-DEL-3', $2, 'citizen', $3,
         'under_legal_review', now(), now(), now())`,
        [caseId, AREA, office],
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
      for (const lawyerId of ["lawyer", "outro_advogado"]) {
        await db.query(
          `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
           VALUES ($1, 'active', now() + interval '1 month', 'test', $1 || '-del')`,
          [lawyerId],
        );
      }

      await db.exec(
        "CREATE ROLE del_advogado; GRANT SELECT, DELETE ON legal_cases TO del_advogado; SET ROLE del_advogado",
      );

      // "outro_advogado" não tem atribuição a este caso: não exclui.
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      expect(
        (await db.query("DELETE FROM legal_cases WHERE id = $1 RETURNING id", [caseId])).rows,
      ).toEqual([]);

      // "lawyer" tem acesso: exclui.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect(
        (await db.query("DELETE FROM legal_cases WHERE id = $1 RETURNING id", [caseId])).rows,
      ).toEqual([{ id: caseId }]);
    } finally {
      await db.close();
    }
  });

  it("contrato: exclui rascunho ou cancelado, nunca enviado ou assinado", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = randomUUID();
      const caseId = randomUUID();
      const rascunho = randomUUID();
      const assinado = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório')", [office]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-DEL-4', $2, 'citizen', $3,
         'in_negotiation', now(), now(), now())`,
        [caseId, AREA, office],
      );
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, status, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'draft', 'admin')`,
        [rascunho, caseId],
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, status, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'signed', 'admin')`,
        [assinado, caseId],
      );

      await db.exec(
        "CREATE ROLE del_contrato; GRANT SELECT, DELETE ON contracts TO del_contrato; SET ROLE del_contrato",
      );
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      expect(
        (await db.query("DELETE FROM contracts WHERE id = $1 RETURNING id", [rascunho])).rows,
      ).toEqual([{ id: rascunho }]);
      expect(
        (await db.query("DELETE FROM contracts WHERE id = $1 RETURNING id", [assinado])).rows,
      ).toEqual([]);

      await db.exec("RESET ROLE");
      expect(
        (await db.query("SELECT id FROM contracts WHERE id = $1", [assinado])).rows,
      ).toHaveLength(1);
    } finally {
      await db.close();
    }
  });
});
