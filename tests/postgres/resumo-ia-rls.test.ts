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

describe("F3/PR: resumo de caso por IA — RLS", () => {
  it("só advogado com acesso ao caso ou admin do escritório leem/gravam; gerar de novo substitui o anterior", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();

      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-RESUMO', $2, 'citizen', $3,
         'under_legal_review', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      // A assinatura agora e do escritorio (quem paga e o admin), nao do advogado individual.
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('admin', 'active', now() + interval '1 month', 'test', 'auto-admin-sub-1')`,
      );
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
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('lawyer', 'active', now() + interval '1 month', 'test', 'resumo-paid')`,
      );

      await db.exec(
        "CREATE ROLE resumo_tester; GRANT SELECT, INSERT, UPDATE ON case_ai_summaries TO resumo_tester; SET ROLE resumo_tester",
      );

      // "outro_advogado" não tem acesso ao caso: não grava nem lê.
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      await expect(
        db.query(
          `INSERT INTO case_ai_summaries(case_id, sintese, pedido_principal, pontos_chave,
            documentos_faltantes, riscos_aparentes, modelo, gerado_por)
           VALUES ($1, 'x', 'x', '[]', '[]', '[]', 'claude-sonnet-5-5', 'outro_advogado')`,
          [caseId],
        ),
      ).rejects.toThrow();

      // "lawyer" (responsável e com acesso) gera o primeiro resumo.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query(
        `INSERT INTO case_ai_summaries(case_id, sintese, pedido_principal, pontos_chave,
          documentos_faltantes, riscos_aparentes, modelo, gerado_por)
         VALUES ($1, 'primeira síntese', 'primeiro pedido', '["a"]', '[]', '[]', 'claude-sonnet-5-5', 'lawyer')`,
        [caseId],
      );
      expect(
        (await db.query<{ sintese: string }>("SELECT sintese FROM case_ai_summaries WHERE case_id = $1", [
          caseId,
        ])).rows,
      ).toEqual([{ sintese: "primeira síntese" }]);

      // gerar de novo substitui (uma linha por caso).
      await db.query(
        `INSERT INTO case_ai_summaries(case_id, sintese, pedido_principal, pontos_chave,
          documentos_faltantes, riscos_aparentes, modelo, gerado_por)
         VALUES ($1, 'segunda síntese', 'segundo pedido', '["b"]', '[]', '[]', 'claude-sonnet-5-5', 'lawyer')
         ON CONFLICT (case_id) DO UPDATE SET sintese = excluded.sintese, pedido_principal = excluded.pedido_principal,
           pontos_chave = excluded.pontos_chave, gerado_por = excluded.gerado_por, gerado_em = now()`,
        [caseId],
      );
      const rows = await db.query<{ sintese: string }>(
        "SELECT sintese FROM case_ai_summaries WHERE case_id = $1",
        [caseId],
      );
      expect(rows.rows).toEqual([{ sintese: "segunda síntese" }]);

      // admin do mesmo escritório lê, mesmo sem ser quem gerou.
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      expect(
        (await db.query("SELECT sintese FROM case_ai_summaries WHERE case_id = $1", [caseId])).rows,
      ).toEqual([{ sintese: "segunda síntese" }]);

      // "outro_advogado" continua sem ver nada.
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      expect(
        (await db.query("SELECT sintese FROM case_ai_summaries WHERE case_id = $1", [caseId])).rows,
      ).toHaveLength(0);
    } finally {
      await db.close();
    }
  });
});
