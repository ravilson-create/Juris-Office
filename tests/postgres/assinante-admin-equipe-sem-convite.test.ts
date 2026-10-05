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

const AREA = "11111111-1111-4111-8111-111111111111";

/**
 * Migração 0031: papel do assinante (admin), assinatura por escritório, cadastro direto de
 * membro (sem convite) e "finalizar e assinar" petição/peça.
 */
describe("cadastrar_membro_equipe_direto", () => {
  it("admin cadastra advogado direto, com OAB já confirmada por ele mesmo", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      await db.query(
        "SELECT cadastrar_membro_equipe_direto($1, $2, $3, $4, $5, $6)",
        ["novo-advogado", "novo@example.com", "lawyer", "52998224725", "654321", "ma"],
      );

      const [perfil] = (
        await db.query<{
          role: string;
          office_id: string;
          oab_numero: string;
          oab_uf: string;
          oab_verificado_em: Date | null;
          oab_verificado_por: string | null;
        }>(
          `SELECT role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por
           FROM profiles WHERE user_id = 'novo-advogado'`,
        )
      ).rows;
      expect(perfil.role).toBe("lawyer");
      expect(perfil.office_id).toBe(office);
      expect(perfil.oab_numero).toBe("654321");
      expect(perfil.oab_uf).toBe("MA");
      expect(perfil.oab_verificado_em).not.toBeNull();
      // Confirmada na hora pelo próprio admin que cadastrou — nunca por quem foi cadastrado.
      expect(perfil.oab_verificado_por).toBe("admin");
    } finally {
      await db.close();
    }
  });

  it("cadastro de advogado sem OAB é rejeitado; administrativo não exige OAB", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      await expect(
        db.query("SELECT cadastrar_membro_equipe_direto($1, $2, $3, $4, $5, $6)", [
          "sem-oab",
          "semoab@example.com",
          "lawyer",
          "52998224725",
          null,
          null,
        ]),
      ).rejects.toThrow();

      await db.query("SELECT cadastrar_membro_equipe_direto($1, $2, $3, $4, $5, $6)", [
        "administrativo-1",
        "adm1@example.com",
        "staff",
        "11144477735",
        null,
        null,
      ]);
      const [perfil] = (
        await db.query<{ role: string; oab_numero: string | null }>(
          "SELECT role, oab_numero FROM profiles WHERE user_id = 'administrativo-1'",
        )
      ).rows;
      expect(perfil.role).toBe("staff");
      expect(perfil.oab_numero).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("não deixa cadastrar quem já está em outro escritório, nem passar de 5 funcionários", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const outroOffice = crypto.randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [outroOffice]);
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1), ('ja-tem-escritorio', 'staff', $2)",
        [office, outroOffice],
      );
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      await expect(
        db.query("SELECT cadastrar_membro_equipe_direto($1, $2, $3, $4, $5, $6)", [
          "ja-tem-escritorio",
          "x@example.com",
          "staff",
          "11144477735",
          null,
          null,
        ]),
      ).rejects.toThrow();

      for (let i = 1; i <= 5; i++) {
        await db.query("SELECT cadastrar_membro_equipe_direto($1, $2, $3, $4, $5, $6)", [
          `staff-${i}`,
          `staff${i}@example.com`,
          "staff",
          "11144477735",
          null,
          null,
        ]);
      }
      await expect(
        db.query("SELECT cadastrar_membro_equipe_direto($1, $2, $3, $4, $5, $6)", [
          "staff-6",
          "staff6@example.com",
          "staff",
          "11144477735",
          null,
          null,
        ]),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});

describe("staff tem acesso de elaboração (não de assinatura)", () => {
  it("administrativo lê e redige petição do escritório, mas não assina o contrato", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id, status,
           submitted_at, created_at, updated_at) VALUES ($1, 'JO-STAFF', $2, 'citizen', $3,
           'submitted', now(), now(), now())`,
        [caseId, AREA, office],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1), ('adm-1', 'staff', $1)",
        [office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('admin', 'active', now() + interval '1 month', 'test')`,
      );
      await db.exec(
        "CREATE ROLE staff_tester; GRANT SELECT, INSERT ON legal_cases, case_petitions, contracts, contract_signatures TO staff_tester; SET ROLE staff_tester",
      );
      await db.query("SELECT set_config('app.user_id', 'adm-1', false)");
      expect((await db.query("SELECT id FROM legal_cases WHERE id = $1", [caseId])).rows).toEqual([
        { id: caseId },
      ]);

      const petitionId = crypto.randomUUID();
      await db.query(
        `INSERT INTO case_petitions(id, case_id, modelo_id, titulo_modelo, secoes, criado_por)
         VALUES ($1, $2, 'familia.acao_alimentos', 'Ação de Alimentos', '[]'::jsonb, 'adm-1')`,
        [petitionId, caseId],
      );
      expect((await db.query("SELECT id FROM case_petitions WHERE id = $1", [petitionId])).rows).toEqual([
        { id: petitionId },
      ]);

      const contractId = crypto.randomUUID();
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'adm-1')`,
        [contractId, caseId],
      );
      await expect(
        db.query(
          `INSERT INTO contract_signatures(id, contract_id, signer_role, signed_by, signed_at, ip, user_agent, signature_hash)
           VALUES ($1, $2, 'lawyer', 'adm-1', now(), '127.0.0.1', 'test', 'hash')`,
          [crypto.randomUUID(), contractId],
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});

describe("finalizar_peticao", () => {
  it("só advogado com OAB confirmada assina; depois disso a versão não aceita mais UPDATE", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id, status,
           submitted_at, created_at, updated_at) VALUES ($1, 'JO-FIN', $2, 'citizen', $3,
           'submitted', now(), now(), now())`,
        [caseId, AREA, office],
      );
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1), ('adm-1', 'staff', $1)`,
        [office],
      );
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('advogado-1', 'lawyer', $1, '123456', 'MA', now(), 'admin')`,
        [office],
      );
      // 'lawyer' só vê/assina caso atribuído a ele — diferente de admin/staff, que veem qualquer
      // caso do escritório (can_read_case, migração 0031).
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'advogado-1', $2)",
        [caseId, office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('admin', 'active', now() + interval '1 month', 'test')`,
      );

      await db.exec(
        `CREATE ROLE fin_tester;
         GRANT SELECT, INSERT, UPDATE ON case_petitions TO fin_tester;
         GRANT EXECUTE ON FUNCTION finalizar_peticao(uuid) TO fin_tester;
         GRANT INSERT ON audit_logs TO fin_tester;
         GRANT USAGE ON SEQUENCE audit_logs_id_seq TO fin_tester;
         SET ROLE fin_tester`,
      );
      const petitionId = crypto.randomUUID();
      await db.query("SELECT set_config('app.user_id', 'adm-1', false)");
      await db.query(
        `INSERT INTO case_petitions(id, case_id, modelo_id, titulo_modelo, secoes, criado_por)
         VALUES ($1, $2, 'familia.acao_alimentos', 'Ação de Alimentos', '[]'::jsonb, 'adm-1')`,
        [petitionId, caseId],
      );

      // administrativo (sem OAB) não consegue finalizar.
      await expect(db.query("SELECT finalizar_peticao($1)", [petitionId])).rejects.toThrow();

      // advogado com OAB confirmada finaliza.
      await db.query("SELECT set_config('app.user_id', 'advogado-1', false)");
      await db.query("SELECT finalizar_peticao($1)", [petitionId]);
      const [depois] = (
        await db.query<{ finalizado_em: Date | null; finalizado_por: string | null }>(
          "SELECT finalizado_em, finalizado_por FROM case_petitions WHERE id = $1",
          [petitionId],
        )
      ).rows;
      expect(depois.finalizado_em).not.toBeNull();
      expect(depois.finalizado_por).toBe("advogado-1");

      // depois de assinada, nem o próprio advogado edita mais essa versão.
      await expect(
        db.query(
          "UPDATE case_petitions SET secoes = '[{\"chave\":\"x\",\"titulo\":\"x\",\"corpo\":\"x\"}]'::jsonb WHERE id = $1",
          [petitionId],
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
