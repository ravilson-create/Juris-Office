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

const OFFICE = "00000000-0000-4000-8000-000000000001";

describe("Convite de equipe: office_invites + convidar/cancelar/aceitar_convite_equipe", () => {
  it("admin convida um advogado (exige OAB) e um administrativo (só CPF)", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        OFFICE,
      ]);
      await db.exec(
        "CREATE ROLE convite_admin; GRANT SELECT, INSERT, UPDATE ON profiles TO convite_admin; GRANT SELECT, INSERT, UPDATE ON office_invites TO convite_admin; GRANT INSERT ON audit_logs TO convite_admin; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO convite_admin; SET ROLE convite_admin",
      );
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      await db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
        randomUUID(),
        "advogada@example.com",
        "lawyer",
        "11144477735",
        "123456",
        "ma",
      ]);
      await db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
        randomUUID(),
        "admin.financeiro@example.com",
        "staff",
        "52998224725",
        null,
        null,
      ]);

      const rows = (
        await db.query<{ email: string; role: string; oab_numero: string | null; oab_uf: string | null }>(
          "SELECT email, role, oab_numero, oab_uf FROM office_invites ORDER BY email",
        )
      ).rows;
      expect(rows).toEqual([
        { email: "admin.financeiro@example.com", role: "staff", oab_numero: null, oab_uf: null },
        { email: "advogada@example.com", role: "lawyer", oab_numero: "123456", oab_uf: "MA" },
      ]);
    } finally {
      await db.close();
    }
  });

  it("administrativo sem OAB e advogado sem OAB são rejeitados pela restrição do banco", async () => {
    const db = await migrarBancoNovo();
    try {
      await expect(
        db.query(
          `INSERT INTO office_invites(id, office_id, email, role, cpf, invited_by)
           VALUES ($1, $2, 'sem-oab@example.com', 'lawyer', '11144477735', 'admin')`,
          [randomUUID(), OFFICE],
        ),
      ).rejects.toThrow();
      await expect(
        db.query(
          `INSERT INTO office_invites(id, office_id, email, role, cpf, oab_numero, oab_uf, invited_by)
           VALUES ($1, $2, 'staff-com-oab@example.com', 'staff', '11144477735', '123456', 'MA', 'admin')`,
          [randomUUID(), OFFICE],
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });

  it("quem não é admin não convida; admin de outro escritório não cancela convite alheio", async () => {
    const db = await migrarBancoNovo();
    try {
      const outroEscritorio = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        outroEscritorio,
      ]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id) VALUES
           ('admin', 'admin', $1), ('advogado', 'lawyer', $1), ('admin-de-fora', 'admin', $2)`,
        [OFFICE, outroEscritorio],
      );
      await db.exec(
        "CREATE ROLE convite_iso; GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO convite_iso; GRANT SELECT, INSERT, UPDATE, DELETE ON office_invites TO convite_iso; GRANT INSERT ON audit_logs TO convite_iso; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO convite_iso; SET ROLE convite_iso",
      );

      // advogado (não admin) do próprio escritório não convida.
      await db.query("SELECT set_config('app.user_id', 'advogado', false)");
      await expect(
        db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
          randomUUID(),
          "alvo@example.com",
          "staff",
          "52998224725",
          null,
          null,
        ]),
      ).rejects.toThrow(/apenas administradores/);

      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      const inviteId = randomUUID();
      await db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
        inviteId,
        "alvo@example.com",
        "staff",
        "52998224725",
        null,
        null,
      ]);

      // admin de outro escritório não enxerga nem cancela esse convite — cancelar_convite_equipe
      // só apaga dentro do próprio escritório do ator, então vira um no-op silencioso.
      await db.query("SELECT set_config('app.user_id', 'admin-de-fora', false)");
      await db.query("SELECT cancelar_convite_equipe($1)", [inviteId]);
      await db.exec("RESET ROLE");
      expect(
        (await db.query("SELECT id FROM office_invites WHERE id = $1", [inviteId])).rows,
      ).toHaveLength(1);

      // o admin certo cancela normalmente.
      await db.exec("SET ROLE convite_iso");
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      await db.query("SELECT cancelar_convite_equipe($1)", [inviteId]);
      const restantes = (await db.query("SELECT id FROM office_invites WHERE id = $1", [inviteId]))
        .rows;
      expect(restantes).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("não deixa passar de 5 funcionários contando convites pendentes", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        OFFICE,
      ]);
      await db.exec(
        "CREATE ROLE convite_limite; GRANT SELECT, INSERT, UPDATE ON profiles TO convite_limite; GRANT SELECT, INSERT, UPDATE ON office_invites TO convite_limite; GRANT INSERT ON audit_logs TO convite_limite; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO convite_limite; SET ROLE convite_limite",
      );
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      for (let i = 0; i < 5; i++) {
        await db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
          randomUUID(),
          `membro-${i}@example.com`,
          "staff",
          "52998224725",
          null,
          null,
        ]);
      }
      await expect(
        db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
          randomUUID(),
          "sexto@example.com",
          "staff",
          "52998224725",
          null,
          null,
        ]),
      ).rejects.toThrow(/5 funcionários/);
    } finally {
      await db.close();
    }
  });

  it("reconvidar o mesmo e-mail pendente atualiza o convite existente, não duplica", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        OFFICE,
      ]);
      await db.exec(
        "CREATE ROLE convite_reenvio; GRANT SELECT, INSERT, UPDATE ON profiles TO convite_reenvio; GRANT SELECT, INSERT, UPDATE ON office_invites TO convite_reenvio; GRANT INSERT ON audit_logs TO convite_reenvio; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO convite_reenvio; SET ROLE convite_reenvio",
      );
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      await db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
        randomUUID(),
        "repetido@example.com",
        "staff",
        "52998224725",
        null,
        null,
      ]);
      await db.query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
        randomUUID(),
        "REPETIDO@example.com",
        "lawyer",
        "11144477735",
        "999999",
        "sp",
      ]);

      const rows = (
        await db.query<{ role: string; oab_numero: string | null }>(
          "SELECT role, oab_numero FROM office_invites WHERE lower(email) = 'repetido@example.com'",
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ role: "lawyer", oab_numero: "999999" });
    } finally {
      await db.close();
    }
  });

  it("aceitar_convite_equipe vincula a pessoa ao escritório certo, com OAB atribuída a quem convidou", async () => {
    const db = await migrarBancoNovo();
    try {
      const inviteId = randomUUID();
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        OFFICE,
      ]);
      await db.query(
        `INSERT INTO office_invites(id, office_id, email, role, cpf, oab_numero, oab_uf, invited_by)
         VALUES ($1, $2, 'nova@example.com', 'lawyer', '11144477735', '123456', 'MA', 'admin')`,
        [inviteId, OFFICE],
      );
      // A pessoa convidada já existe como 'citizen' sem escritório — mesmo estado que
      // aceitarConvitePendente() encontra em todo primeiro login (bootstrap-admin.ts cria essa
      // linha antes de tentar aceitar um convite).
      await db.query("INSERT INTO profiles(user_id, role) VALUES ('nova-pessoa', 'citizen')");

      await db.exec(
        "CREATE ROLE convite_aceite; GRANT SELECT, UPDATE ON profiles TO convite_aceite; GRANT SELECT, UPDATE ON office_invites TO convite_aceite; GRANT INSERT ON audit_logs TO convite_aceite; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO convite_aceite; SET ROLE convite_aceite",
      );
      await db.query("SELECT set_config('app.user_id', 'nova-pessoa', false)");
      await db.query("SELECT aceitar_convite_equipe($1)", ["NOVA@example.com"]);

      const [perfil] = (
        await db.query<{
          role: string;
          office_id: string;
          cpf: string;
          oab_numero: string;
          oab_uf: string;
          oab_verificado_por: string;
        }>(
          "SELECT role, office_id, cpf, oab_numero, oab_uf, oab_verificado_por FROM profiles WHERE user_id = 'nova-pessoa'",
        )
      ).rows;
      expect(perfil).toEqual({
        role: "lawyer",
        office_id: OFFICE,
        cpf: "11144477735",
        oab_numero: "123456",
        oab_uf: "MA",
        oab_verificado_por: "admin",
      });

      // office_invites só é visível a admin do próprio escritório (RLS) — 'nova-pessoa' agora é
      // advogada, não admin, então a conferência final é feita como dono, fora da RLS.
      await db.exec("RESET ROLE");
      const [convite] = (
        await db.query<{ accepted_by: string | null }>(
          "SELECT accepted_by FROM office_invites WHERE id = $1",
          [inviteId],
        )
      ).rows;
      expect(convite.accepted_by).toBe("nova-pessoa");
    } finally {
      await db.close();
    }
  });

  it("aceitar_convite_equipe não faz nada para quem já tem escritório", async () => {
    const db = await migrarBancoNovo();
    try {
      const inviteId = randomUUID();
      const outroEscritorio = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        outroEscritorio,
      ]);
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        OFFICE,
      ]);
      await db.query(
        `INSERT INTO office_invites(id, office_id, email, role, cpf, invited_by)
         VALUES ($1, $2, 'ocupado@example.com', 'staff', '52998224725', 'admin')`,
        [inviteId, OFFICE],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('ja-tem-escritorio', 'lawyer', $1)",
        [outroEscritorio],
      );
      await db.exec(
        "CREATE ROLE convite_ocupado; GRANT SELECT, UPDATE ON profiles TO convite_ocupado; GRANT SELECT, UPDATE ON office_invites TO convite_ocupado; GRANT INSERT ON audit_logs TO convite_ocupado; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO convite_ocupado; SET ROLE convite_ocupado",
      );
      await db.query("SELECT set_config('app.user_id', 'ja-tem-escritorio', false)");
      await db.query("SELECT aceitar_convite_equipe($1)", ["ocupado@example.com"]);

      const [perfil] = (
        await db.query<{ office_id: string }>(
          "SELECT office_id FROM profiles WHERE user_id = 'ja-tem-escritorio'",
        )
      ).rows;
      expect(perfil.office_id).toBe(outroEscritorio);
      await db.exec("RESET ROLE");
      const [convite] = (
        await db.query<{ accepted_at: Date | null }>(
          "SELECT accepted_at FROM office_invites WHERE id = $1",
          [inviteId],
        )
      ).rows;
      expect(convite.accepted_at).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("remove_from_office solta um 'staff' de volta a 'citizen' e limpa o CPF", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)",
        [OFFICE],
      );
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id, cpf) VALUES ('funcionario', 'staff', $1, '52998224725')",
        [OFFICE],
      );
      await db.exec(
        "CREATE ROLE remocao_staff; GRANT SELECT, UPDATE, DELETE ON profiles TO remocao_staff; GRANT DELETE ON case_assignments TO remocao_staff; GRANT INSERT ON audit_logs TO remocao_staff; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO remocao_staff; SET ROLE remocao_staff",
      );
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      await db.query("SELECT remove_from_office($1)", ["funcionario"]);

      // sem escritório, nem admin_office_profiles nem profile_self (de outro ator) alcança mais
      // essa linha — a conferência final é feita como dono, fora da RLS (mesmo padrão de
      // gestao-equipe-rls.test.ts).
      await db.exec("RESET ROLE");
      const [perfil] = (
        await db.query<{ role: string; office_id: string | null; cpf: string | null }>(
          "SELECT role, office_id, cpf FROM profiles WHERE user_id = 'funcionario'",
        )
      ).rows;
      expect(perfil).toEqual({ role: "citizen", office_id: null, cpf: null });
    } finally {
      await db.close();
    }
  });
});
