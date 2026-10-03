import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";
import type { ContractContent } from "@/domain/contract/schema";

vi.mock("server-only", () => ({}));

const { assinarContrato, assinarContratoAdvogado, criarContrato, listarContratos } = await import(
  "@/lib/services/equipe-contratos"
);

async function migrar(db: PGlite) {
  const dir = join(process.cwd(), "db/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
}

function wrap(db: PGlite): Db {
  return {
    query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
      (await db.query(text, params)).rows as T[],
    transaction: async <T>(fn: (tx: Queryable) => Promise<T>) =>
      db.transaction((tx) =>
        fn({
          query: async <R = Record<string, unknown>>(text: string, params?: unknown[]) =>
            (await tx.query(text, params)).rows as R[],
        }),
      ),
  };
}

const CONTEUDO: ContractContent = {
  lawyerFullName: "Fulano de Tal",
  lawyerCpf: "11144477735",
  oabNumero: "123456",
  oabUf: "MA",
  officeName: "Escritório Teste",
  officeCpfCnpj: "12345678000195",
  officeAddress: "Rua Um, 100, Centro, São Luís/MA",
  clientFullName: "Cliente Teste",
  clientCpf: "52998224725",
  clientAddress: "Rua Dois, 200, Centro, São Luís/MA",
  object: "Ação de cobrança referente a serviços prestados e não pagos pela parte ré.",
  forumCity: "São Luís",
  forumUf: "MA",
};

describe("cláusulas do contrato + assinatura do advogado + aba de assinaturas do admin do app", () => {
  it("RLS: o advogado assina o próprio contrato só enquanto 'draft', nunca o de outro advogado", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();
      const contractId = crypto.randomUUID();

      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-ADVASS', $2, 'citizen', $3,
         'in_negotiation', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
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
           VALUES ($1, 'active', now() + interval '1 month', 'test', $1 || '-advass')`,
          [lawyerId],
        );
      }
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'lawyer')`,
        [contractId, caseId],
      );

      await db.exec(
        `CREATE ROLE advass_tester;
         GRANT SELECT, UPDATE ON contracts TO advass_tester;
         GRANT SELECT, INSERT ON contract_signatures TO advass_tester;
         SET ROLE advass_tester`,
      );

      // "outro_advogado" tem acesso ao caso (mesmo escritório, admin global de contratos por
      // can_read_case), mas não pode assinar em nome de "lawyer" — signed_by tem que ser o
      // próprio app_actor_id().
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      await expect(
        db.query(
          `INSERT INTO contract_signatures(id, contract_id, signer_role, signed_by, signed_at, ip, user_agent, signature_hash)
           VALUES ($1, $2, 'lawyer', 'lawyer', now(), '203.0.113.1', 'vitest', 'x')`,
          [crypto.randomUUID(), contractId],
        ),
      ).rejects.toThrow();

      // "lawyer" assina o próprio contrato, ainda 'draft'.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query(
        `INSERT INTO contract_signatures(id, contract_id, signer_role, signed_by, signed_at, ip, user_agent, signature_hash)
         VALUES ($1, $2, 'lawyer', 'lawyer', now(), '203.0.113.1', 'vitest', 'x')`,
        [crypto.randomUUID(), contractId],
      );
      await db.query("UPDATE contracts SET status = 'sent' WHERE id = $1", [contractId]);

      // Depois de 'sent', a política de assinatura do advogado (só em 'draft') não aceita mais.
      await expect(
        db.query(
          `INSERT INTO contract_signatures(id, contract_id, signer_role, signed_by, signed_at, ip, user_agent, signature_hash)
           VALUES ($1, $2, 'lawyer', 'lawyer', now(), '203.0.113.1', 'vitest', 'y')`,
          [crypto.randomUUID(), contractId],
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  });

  it("criarContrato grava as cláusulas; assinarContratoAdvogado e assinarContrato movem o status e deixam a trilha de cada papel", async () => {
    const db = await (async () => {
      const p = new PGlite();
      await migrar(p);
      return p;
    })();
    try {
      const office = "00000000-0000-4000-8000-000000000001";
      const caseA = crypto.randomUUID();

      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-GLOBAL-A', $2, 'citizen', $3,
         'in_negotiation', now(), now(), now())`,
        [caseA, crypto.randomUUID(), office],
      );
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id) VALUES ('lawyer_a', 'lawyer', $1)`,
        [office],
      );

      const db2 = wrap(db);

      await criarContrato(db2, {
        caseId: caseA,
        feeType: "fixed",
        feeValueCents: 500000,
        successPercentage: null,
        createdBy: "lawyer_a",
        content: CONTEUDO,
      });
      const [contratoA] = await listarContratos(db2, caseA);
      expect(contratoA!.content).toEqual(CONTEUDO);

      await assinarContratoAdvogado(db2, {
        contractId: contratoA!.id,
        statusAtual: "draft",
        lawyerId: "lawyer_a",
        ip: "203.0.113.5",
        userAgent: "vitest",
      });
      const [enviado] = await listarContratos(db2, caseA);
      expect(enviado!.status).toBe("sent");

      await assinarContrato(db2, {
        contractId: contratoA!.id,
        statusAtual: "sent",
        signedBy: "citizen",
        signedByHash: null,
        signerCpf: CONTEUDO.clientCpf,
        ip: "203.0.113.6",
        userAgent: "vitest",
      });
      const [assinado] = await listarContratos(db2, caseA);
      expect(assinado!.status).toBe("signed");
    } finally {
      await db.close();
    }
  });
});
