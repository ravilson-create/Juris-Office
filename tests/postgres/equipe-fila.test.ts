import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

/**
 * As consultas da fila (lib/services/equipe-fila.ts) somam um filtro de status ao SQL que já
 * existia — este teste prova que o filtro por status e a paginação (LIMIT/OFFSET) funcionam
 * dentro do mesmo isolamento por RLS já provado em p2-auth-rls.test.ts e
 * equipe-dashboard.test.ts: um advogado nunca vê, filtra ou pagina sobre o caso de outro.
 */
describe("fila do advogado: filtro por status e paginação respeitam a RLS", () => {
  it("filtra por status e pagina dentro do que a RLS permite ver", async () => {
    const db = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await db.exec(readFileSync(join(dir, file), "utf8"));
      }
      const office = "00000000-0000-4000-8000-000000000001";
      const otherOffice = crypto.randomUUID();
      const casoA = crypto.randomUUID();
      const casoB = crypto.randomUUID();
      const casoOutroEscritorio = crypto.randomUUID();

      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        otherOffice,
      ]);
      // updated_at diferente garante uma ordem conhecida (ORDER BY updated_at DESC).
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-A', $2, 'citizen', $3,
         'submitted', now(), now(), now() - interval '2 hours')`,
        [casoA, crypto.randomUUID(), office],
      );
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-B', $2, 'citizen', $3,
         'active', now(), now(), now() - interval '1 hour')`,
        [casoB, crypto.randomUUID(), office],
      );
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-OUTRO', $2, 'citizen', $3,
         'submitted', now(), now(), now())`,
        [casoOutroEscritorio, crypto.randomUUID(), otherOffice],
      );
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      // A assinatura agora é do escritório (quem paga é o admin) — sem isto, can_read_case não
      // deixa nem o próprio admin ver caso nenhum (migração 0031).
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('admin', 'active', now() + interval '1 month', 'test', 'fila-admin')`,
      );

      await db.exec("CREATE ROLE fila_reader; GRANT SELECT ON legal_cases TO fila_reader; SET ROLE fila_reader");
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      const statusAtivo = ["active"];
      const porStatusAtivo = await db.query<{ id: string }>(
        `SELECT id FROM legal_cases WHERE status = ANY($1)
           AND ('' = '' OR protocol ILIKE '%' || '' || '%' OR title ILIKE '%' || '' || '%')`,
        [statusAtivo],
      );
      expect(porStatusAtivo.rows).toEqual([{ id: casoB }]); // só o ativo do próprio escritório

      const statusProfissional = [
        "submitted",
        "under_legal_review",
        "needs_information",
        "accepted",
        "rejected",
        "in_negotiation",
        "active",
        "closed",
      ];
      const pagina1 = await db.query<{ id: string }>(
        `SELECT id FROM legal_cases WHERE status = ANY($1)
           AND ('' = '' OR protocol ILIKE '%' || '' || '%' OR title ILIKE '%' || '' || '%')
         ORDER BY updated_at DESC LIMIT 1 OFFSET 0`,
        [statusProfissional],
      );
      expect(pagina1.rows).toEqual([{ id: casoB }]); // mais recente primeiro, nunca o de outro escritório

      const pagina2 = await db.query<{ id: string }>(
        `SELECT id FROM legal_cases WHERE status = ANY($1)
           AND ('' = '' OR protocol ILIKE '%' || '' || '%' OR title ILIKE '%' || '' || '%')
         ORDER BY updated_at DESC LIMIT 1 OFFSET 1`,
        [statusProfissional],
      );
      expect(pagina2.rows).toEqual([{ id: casoA }]);
    } finally {
      await db.close();
    }
  });
});
