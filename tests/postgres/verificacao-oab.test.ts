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

describe("P3/P4: OAB autodeclarada no cadastro, revogável por um admin do escritório", () => {
  it("advogado com assinatura ativa mas OAB não confirmada não enxerga o caso atribuído", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id, status,
           submitted_at, created_at, updated_at) VALUES($1, 'JO-OAB-1', $2, 'citizen', $3,
           'submitted', now(), now(), now())`,
        [caseId, AREA, office],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf) VALUES ('lawyer', 'lawyer', $1, '123456', 'MA')",
        [office],
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('lawyer', 'trial', now() + interval '7 days', 'asaas')`,
      );

      await db.exec("CREATE ROLE oab_reader; GRANT SELECT ON legal_cases TO oab_reader; SET ROLE oab_reader");
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("verify_lawyer_oab só funciona para admin do mesmo escritório, e libera o acesso depois", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = "00000000-0000-4000-8000-000000000001";
      const outroEscritorio = randomUUID();
      const caseId = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        outroEscritorio,
      ]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id, status,
           submitted_at, created_at, updated_at) VALUES($1, 'JO-OAB-2', $2, 'citizen', $3,
           'submitted', now(), now(), now())`,
        [caseId, AREA, office],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf) VALUES ('lawyer', 'lawyer', $1, '123456', 'MA')",
        [office],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1), ('admin-de-fora', 'admin', $2)",
        [office, outroEscritorio],
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('lawyer', 'trial', now() + interval '7 days', 'asaas')`,
      );

      await db.exec(
        "CREATE ROLE oab_admin; GRANT SELECT, UPDATE ON profiles TO oab_admin; GRANT INSERT ON audit_logs TO oab_admin; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO oab_admin; SET ROLE oab_admin",
      );

      // admin de outro escritório não consegue confirmar
      await db.query("SELECT set_config('app.user_id', 'admin-de-fora', false)");
      await db.query("SELECT verify_lawyer_oab($1)", ["lawyer"]);

      // confere (como o admin certo, já que o de fora não enxerga o perfil de outro escritório)
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      const [aindaPendente] = (
        await db.query<{ oab_verificado_em: Date | null }>(
          "SELECT oab_verificado_em FROM profiles WHERE user_id = 'lawyer'",
        )
      ).rows;
      expect(aindaPendente.oab_verificado_em).toBeNull();

      // admin do escritório certo confirma
      await db.query("SELECT verify_lawyer_oab($1)", ["lawyer"]);
      const [confirmado] = (
        await db.query<{ oab_verificado_em: Date | null }>(
          "SELECT oab_verificado_em FROM profiles WHERE user_id = 'lawyer'",
        )
      ).rows;
      expect(confirmado.oab_verificado_em).not.toBeNull();

      // agora o advogado enxerga o caso
      await db.exec("RESET ROLE; GRANT SELECT ON legal_cases TO oab_admin; SET ROLE oab_admin");
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect((await db.query("SELECT id FROM legal_cases")).rows).toEqual([{ id: caseId }]);
    } finally {
      await db.close();
    }
  });

  it("set_own_oab autodeclara na hora (oab_verificado_por = a própria pessoa)", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('lawyer', 'lawyer', $1)",
        [office],
      );
      await db.exec(
        "CREATE ROLE oab_self; GRANT SELECT, UPDATE ON profiles TO oab_self; SET ROLE oab_self",
      );
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query("SELECT set_own_oab($1, $2)", ["123456", "ma"]);

      const [row] = (
        await db.query<{
          oab_numero: string;
          oab_uf: string;
          oab_verificado_em: Date | null;
          oab_verificado_por: string | null;
        }>(
          "SELECT oab_numero, oab_uf, oab_verificado_em, oab_verificado_por FROM profiles WHERE user_id = 'lawyer'",
        )
      ).rows;
      expect(row.oab_numero).toBe("123456");
      expect(row.oab_uf).toBe("MA");
      expect(row.oab_verificado_em).not.toBeNull();
      // Autodeclarada: quem "confirmou" é o próprio advogado, nunca um humano de verdade —
      // é essa igualdade que a tela de equipe usa para rotular "autodeclarada" x "confirmada".
      expect(row.oab_verificado_por).toBe("lawyer");
    } finally {
      await db.close();
    }
  });

  it("mudar o número da OAB demite uma confirmação de admin de volta a autodeclarada", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)",
        [office],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por) VALUES ('lawyer', 'lawyer', $1, '123456', 'MA', now(), 'admin')",
        [office],
      );
      await db.exec("CREATE ROLE oab_self; GRANT SELECT, UPDATE ON profiles TO oab_self; SET ROLE oab_self");
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query("SELECT set_own_oab($1, $2)", ["654321", "sp"]);

      const [row] = (
        await db.query<{
          oab_numero: string;
          oab_uf: string;
          oab_verificado_em: Date | null;
          oab_verificado_por: string | null;
        }>(
          "SELECT oab_numero, oab_uf, oab_verificado_em, oab_verificado_por FROM profiles WHERE user_id = 'lawyer'",
        )
      ).rows;
      // O número novo nunca foi conferido pelo admin — a confiança no número antigo não vale
      // para o novo. Continua "confirmada" (nunca fica pendente de novo sozinho), mas agora como
      // autodeclaração do próprio advogado, não mais como confirmação do admin.
      expect(row.oab_numero).toBe("654321");
      expect(row.oab_uf).toBe("SP");
      expect(row.oab_verificado_em).not.toBeNull();
      expect(row.oab_verificado_por).toBe("lawyer");
    } finally {
      await db.close();
    }
  });

  it("revoke_lawyer_oab só funciona para admin do mesmo escritório, e bloqueia o acesso de novo", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = "00000000-0000-4000-8000-000000000001";
      const outroEscritorio = randomUUID();
      const caseId = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        outroEscritorio,
      ]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id, status,
           submitted_at, created_at, updated_at) VALUES($1, 'JO-OAB-3', $2, 'citizen', $3,
           'submitted', now(), now(), now())`,
        [caseId, AREA, office],
      );
      // Autodeclarada (oab_verificado_por = 'lawyer', a própria pessoa) — estado que
      // set_own_oab deixa logo no cadastro.
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por) VALUES ('lawyer', 'lawyer', $1, '123456', 'MA', now(), 'lawyer')",
        [office],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1), ('admin-de-fora', 'admin', $2)",
        [office, outroEscritorio],
      );
      await db.query(
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('lawyer', 'trial', now() + interval '7 days', 'asaas')`,
      );

      await db.exec(
        "CREATE ROLE oab_revoke; GRANT SELECT, UPDATE ON profiles TO oab_revoke; GRANT INSERT ON audit_logs TO oab_revoke; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO oab_revoke; SET ROLE oab_revoke",
      );

      // admin de outro escritório não consegue revogar
      await db.query("SELECT set_config('app.user_id', 'admin-de-fora', false)");
      await db.query("SELECT revoke_lawyer_oab($1)", ["lawyer"]);
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      const [aindaConfirmada] = (
        await db.query<{ oab_verificado_em: Date | null }>(
          "SELECT oab_verificado_em FROM profiles WHERE user_id = 'lawyer'",
        )
      ).rows;
      expect(aindaConfirmada.oab_verificado_em).not.toBeNull();

      // admin do escritório certo revoga
      await db.query("SELECT revoke_lawyer_oab($1)", ["lawyer"]);
      const [revogada] = (
        await db.query<{ oab_verificado_em: Date | null; oab_verificado_por: string | null }>(
          "SELECT oab_verificado_em, oab_verificado_por FROM profiles WHERE user_id = 'lawyer'",
        )
      ).rows;
      expect(revogada).toEqual({ oab_verificado_em: null, oab_verificado_por: null });

      // o advogado perde o acesso ao caso
      await db.exec("RESET ROLE; GRANT SELECT ON legal_cases TO oab_revoke; SET ROLE oab_revoke");
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect((await db.query("SELECT id FROM legal_cases")).rows).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
});
