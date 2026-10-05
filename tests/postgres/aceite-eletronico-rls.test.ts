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

describe("P5/PR5: aceite eletrônico de contrato — RLS", () => {
  it("só o cliente dono do caso assina; a trilha de auditoria fica gravada e o advogado não pode pular direto para 'signed'", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();
      const contractId = crypto.randomUUID();
      const outroCaseId = crypto.randomUUID();
      const outroContractId = crypto.randomUUID();

      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-ACEITE', $2, 'cliente', $3,
         'in_negotiation', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-OUTRO', $2, 'outro_cliente', $3,
         'in_negotiation', now(), now(), now())`,
        [outroCaseId, crypto.randomUUID(), office],
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
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('lawyer', 'active', now() + interval '1 month', 'test', 'aceite-paid')`,
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, status, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'sent', 'lawyer')`,
        [contractId, caseId],
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, status, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'sent', 'admin')`,
        [outroContractId, outroCaseId],
      );

      await db.exec(
        `CREATE ROLE aceite_tester;
         GRANT SELECT, INSERT, UPDATE ON contracts TO aceite_tester;
         GRANT SELECT, INSERT ON contract_signatures TO aceite_tester;
         SET ROLE aceite_tester`,
      );

      // o cliente de outro caso não vê nem assina o contrato deste caso.
      await db.query("SELECT set_config('app.user_id', 'outro_cliente', false)");
      expect(
        (await db.query("SELECT id FROM contracts WHERE id = $1", [contractId])).rows,
      ).toHaveLength(0);
      await expect(
        db.query("UPDATE contracts SET status = 'signed' WHERE id = $1", [contractId]),
      ).resolves.not.toThrow(); // RLS filtra: zero linhas afetadas, nunca lança

      // o cliente dono vê o contrato 'sent' e assina.
      await db.query("SELECT set_config('app.user_id', 'cliente', false)");
      const antes = await db.query<{ status: string }>(
        "SELECT status FROM contracts WHERE id = $1",
        [contractId],
      );
      expect(antes.rows).toEqual([{ status: "sent" }]);

      // ordem importa: signatures_insert só aceita enquanto o contrato ainda está 'sent'.
      await db.query(
        `INSERT INTO contract_signatures(id, contract_id, signed_by, ip, user_agent, signature_hash)
         VALUES ($1, $2, 'cliente', '203.0.113.9', 'vitest', 'abc')`,
        [crypto.randomUUID(), contractId],
      );
      await db.query(
        "UPDATE contracts SET status = 'signed', signed_at = now(), signature_hash = 'abc' WHERE id = $1",
        [contractId],
      );

      const depois = await db.query<{ status: string }>(
        "SELECT status FROM contracts WHERE id = $1",
        [contractId],
      );
      expect(depois.rows).toEqual([{ status: "signed" }]);
      const assinatura = await db.query<{ contract_id: string }>(
        "SELECT contract_id FROM contract_signatures WHERE contract_id = $1",
        [contractId],
      );
      expect(assinatura.rows).toEqual([{ contract_id: contractId }]);

      // advogado com acesso ao caso lê o contrato assinado.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      const lido = await db.query<{ status: string }>(
        "SELECT status FROM contracts WHERE id = $1",
        [contractId],
      );
      expect(lido.rows).toEqual([{ status: "signed" }]);

      // mas nenhum advogado/admin grava 'signed' direto, pulando a trilha de auditoria — a
      // política contracts_update (migração 0012) agora exige status <> 'signed' no CHECK.
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      await expect(
        db.query("UPDATE contracts SET status = 'signed' WHERE id = $1", [outroContractId]),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
