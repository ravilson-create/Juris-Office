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

/**
 * Testa diretamente o SQL usado por definirStatusAssinaturaAction (app/equipe/assinaturas/
 * actions.ts) — a ação em si é "use server" e chamada só por um admin do app (isAppOwner), aqui
 * verificamos a semântica das duas atualizações manuais: ativar estende valid_until e limpa o
 * cancelamento agendado; desativar só muda o status.
 */
describe("ativar/desativar assinatura manualmente (admin do app)", () => {
  it("ativar: status vira active, valid_until é estendido se já vencido, cancelar_em_renovacao é limpo", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('lawyer_a', 'lawyer', $1, 'a@x.com')`,
        [office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref, cancelar_em_renovacao)
         VALUES ('lawyer_a', 'past_due', now() - interval '1 day', 'asaas', 'sub-a', true)`,
      );

      await db.query(
        `UPDATE lawyer_subscriptions
         SET status = 'active', valid_until = GREATEST(valid_until, now() + interval '30 days'),
             cancelar_em_renovacao = false, updated_at = now()
         WHERE lawyer_id = 'lawyer_a'`,
      );

      const { rows } = await db.query<{
        status: string;
        valid_until: string;
        cancelar_em_renovacao: boolean;
      }>(
        "SELECT status, valid_until, cancelar_em_renovacao FROM lawyer_subscriptions WHERE lawyer_id = 'lawyer_a'",
      );
      expect(rows[0]!.status).toBe("active");
      expect(rows[0]!.cancelar_em_renovacao).toBe(false);
      expect(new Date(rows[0]!.valid_until).getTime()).toBeGreaterThan(Date.now());
    } finally {
      await db.close();
    }
  });

  it("desativar: status vira canceled, sem alterar valid_until", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('lawyer_a', 'lawyer', $1, 'a@x.com')`,
        [office],
      );
      const validUntil = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('lawyer_a', 'active', $1, 'asaas', 'sub-a')`,
        [validUntil],
      );

      await db.query(
        `UPDATE lawyer_subscriptions SET status = 'canceled', updated_at = now()
         WHERE lawyer_id = 'lawyer_a'`,
      );

      const { rows } = await db.query<{ status: string; valid_until: string }>(
        "SELECT status, valid_until FROM lawyer_subscriptions WHERE lawyer_id = 'lawyer_a'",
      );
      expect(rows[0]!.status).toBe("canceled");
      expect(new Date(rows[0]!.valid_until).toISOString()).toBe(validUntil);
    } finally {
      await db.close();
    }
  });
});
