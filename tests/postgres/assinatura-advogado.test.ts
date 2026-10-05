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

const AREA_TESTE = "11111111-1111-4111-8111-111111111111";

describe("P3: cadastro de assinatura do advogado (trial + Asaas)", () => {
  it("start_lawyer_trial cria escritório, promove o perfil e abre o trial de 7 dias", async () => {
    const db = await migrarBancoNovo();
    try {
      const officeId = crypto.randomUUID();
      await db.query("SELECT set_config('app.user_id', 'advogado-1', false)");
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4, $5, $6, $7, $8)", [
        officeId,
        "Escritório Teste",
        "52998224725",
        "monthly",
        "advogado-1@example.com",
        "São Luís",
        "ma",
        [AREA_TESTE],
      ]);

      const [perfil] = (
        await db.query<{
          role: string;
          office_id: string;
          email: string;
          cidade: string;
          uf: string;
        }>("SELECT role, office_id, email, cidade, uf FROM profiles WHERE user_id = 'advogado-1'")
      ).rows;
      // 'admin', não 'lawyer': quem assina (funda o escritório) já nasce administrando a
      // própria equipe — migração 0031.
      expect(perfil).toEqual({
        role: "admin",
        office_id: officeId,
        email: "advogado-1@example.com",
        cidade: "São Luís",
        uf: "MA",
      });

      const areas = (
        await db.query<{ legal_area_id: string }>(
          "SELECT legal_area_id FROM lawyer_areas WHERE lawyer_id = 'advogado-1'",
        )
      ).rows;
      expect(areas).toEqual([{ legal_area_id: AREA_TESTE }]);

      const [assinatura] = (
        await db.query<{ status: string; plano_id: string }>(
          "SELECT status, plano_id FROM lawyer_subscriptions WHERE lawyer_id = 'advogado-1'",
        )
      ).rows;
      expect(assinatura).toEqual({ status: "trial", plano_id: "monthly" });

      const [ativo] = (
        await db.query<{ has_active_subscription: boolean }>(
          "SELECT has_active_subscription('advogado-1')",
        )
      ).rows;
      expect(ativo.has_active_subscription).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("rejeita abrir um segundo escritório para a mesma conta", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query("SELECT set_config('app.user_id', 'advogado-2', false)");
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4, $5, $6, $7, $8)", [
        crypto.randomUUID(),
        "Primeiro Escritório",
        "52998224725",
        "monthly",
        "advogado-2@example.com",
        "São Luís",
        "ma",
        [AREA_TESTE],
      ]);
      await expect(
        db.query("SELECT start_lawyer_trial($1, $2, $3, $4, $5, $6, $7, $8)", [
          crypto.randomUUID(),
          "Segundo Escritório",
          "11144477735",
          "yearly",
          "advogado-2@example.com",
          "São Luís",
          "ma",
          [AREA_TESTE],
        ]),
      ).rejects.toThrow(/já existe cadastro profissional/);
    } finally {
      await db.close();
    }
  });

  it("cancel_own_subscription marca para não renovar sem revogar o acesso corrente", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query("SELECT set_config('app.user_id', 'advogado-3', false)");
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4, $5, $6, $7, $8)", [
        crypto.randomUUID(),
        "Escritório Teste",
        "52998224725",
        "monthly",
        "advogado-3@example.com",
        "São Luís",
        "ma",
        [AREA_TESTE],
      ]);
      await db.query("SELECT cancel_own_subscription()");

      const [assinatura] = (
        await db.query<{ cancelar_em_renovacao: boolean; status: string }>(
          "SELECT cancelar_em_renovacao, status FROM lawyer_subscriptions WHERE lawyer_id = 'advogado-3'",
        )
      ).rows;
      expect(assinatura).toEqual({ cancelar_em_renovacao: true, status: "trial" });

      const [ativo] = (
        await db.query<{ has_active_subscription: boolean }>(
          "SELECT has_active_subscription('advogado-3')",
        )
      ).rows;
      expect(ativo.has_active_subscription).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("set_own_subscription_plan é bloqueado após o cancelamento", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query("SELECT set_config('app.user_id', 'advogado-4', false)");
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4, $5, $6, $7, $8)", [
        crypto.randomUUID(),
        "Escritório Teste",
        "52998224725",
        "monthly",
        "advogado-4@example.com",
        "São Luís",
        "ma",
        [AREA_TESTE],
      ]);
      await db.query("SELECT cancel_own_subscription()");
      await db.query("SELECT set_own_subscription_plan('yearly')");

      const [assinatura] = (
        await db.query<{ plano_id: string }>(
          "SELECT plano_id FROM lawyer_subscriptions WHERE lawyer_id = 'advogado-4'",
        )
      ).rows;
      expect(assinatura.plano_id).toBe("monthly");
    } finally {
      await db.close();
    }
  });

  it("não permite abrir trial em nome de outra conta (app_actor_id manda, não o parâmetro)", async () => {
    const db = await migrarBancoNovo();
    try {
      await db.query("SELECT set_config('app.user_id', '', false)");
      await expect(
        db.query("SELECT start_lawyer_trial($1, $2, $3, $4, $5, $6, $7, $8)", [
          crypto.randomUUID(),
          "Escritório Teste",
          "52998224725",
          "monthly",
          "sem-login@example.com",
          "São Luís",
          "ma",
          [AREA_TESTE],
        ]),
      ).rejects.toThrow(/login necessário/);
    } finally {
      await db.close();
    }
  });
});
