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

describe("P3: cadastro de assinatura do advogado (trial + Asaas)", () => {
  it("start_lawyer_trial cria escritório, promove o perfil e abre o trial de 7 dias", async () => {
    const db = await migrarBancoNovo();
    try {
      const officeId = crypto.randomUUID();
      await db.query("SELECT set_config('app.user_id', 'advogado-1', false)");
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4)", [
        officeId,
        "Escritório Teste",
        "52998224725",
        "monthly",
      ]);

      const [perfil] = (
        await db.query<{ role: string; office_id: string }>(
          "SELECT role, office_id FROM profiles WHERE user_id = 'advogado-1'",
        )
      ).rows;
      expect(perfil).toEqual({ role: "lawyer", office_id: officeId });

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
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4)", [
        crypto.randomUUID(),
        "Primeiro Escritório",
        "52998224725",
        "monthly",
      ]);
      await expect(
        db.query("SELECT start_lawyer_trial($1, $2, $3, $4)", [
          crypto.randomUUID(),
          "Segundo Escritório",
          "11144477735",
          "yearly",
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
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4)", [
        crypto.randomUUID(),
        "Escritório Teste",
        "52998224725",
        "monthly",
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
      await db.query("SELECT start_lawyer_trial($1, $2, $3, $4)", [
        crypto.randomUUID(),
        "Escritório Teste",
        "52998224725",
        "monthly",
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
        db.query("SELECT start_lawyer_trial($1, $2, $3, $4)", [
          crypto.randomUUID(),
          "Escritório Teste",
          "52998224725",
          "monthly",
        ]),
      ).rejects.toThrow(/login necessário/);
    } finally {
      await db.close();
    }
  });
});
