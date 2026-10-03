import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { listarContratosEquipe } = await import("@/lib/services/equipe-contratos");

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

describe("P4/PR4: viabilidade, contrato e parcelas — RLS", () => {
  it("viabilidade: só advogado com acesso ao caso ou admin leem/escrevem; a decisão também move o status do caso", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const caseId = crypto.randomUUID();

      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-VIAB', $2, 'citizen', $3,
         'under_legal_review', now(), now(), now())`,
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
           VALUES ($1, 'active', now() + interval '1 month', 'test', $1 || '-viab')`,
          [lawyerId],
        );
      }

      await db.exec(
        `CREATE ROLE viab_tester;
         GRANT SELECT, INSERT, UPDATE ON case_viability TO viab_tester;
         GRANT SELECT, UPDATE ON legal_cases TO viab_tester;
         SET ROLE viab_tester`,
      );

      // "outro_advogado" não tem acesso ao caso: não grava viabilidade nem muda o status dele.
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      await expect(
        db.query(
          `INSERT INTO case_viability(case_id, feasibility_note, risk, decision, decided_by)
           VALUES ($1, 'tentativa indevida', 'low', 'accepted', 'outro_advogado')`,
          [caseId],
        ),
      ).rejects.toThrow();

      // "lawyer" (responsável e com acesso) aceita a causa.
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      await db.query(
        `INSERT INTO case_viability(case_id, feasibility_note, risk, decision, decided_by)
         VALUES ($1, 'causa viável, boa documentação', 'low', 'accepted', 'lawyer')`,
        [caseId],
      );
      await db.query("UPDATE legal_cases SET status = 'accepted' WHERE id = $1", [caseId]);

      const statusFinal = await db.query<{ status: string }>(
        "SELECT status FROM legal_cases WHERE id = $1",
        [caseId],
      );
      expect(statusFinal.rows).toEqual([{ status: "accepted" }]);

      // admin também lê a decisão (está no mesmo escritório do caso).
      await db.query("SELECT set_config('app.user_id', 'admin', false)");
      const lida = await db.query<{ decision: string }>(
        "SELECT decision FROM case_viability WHERE case_id = $1",
        [caseId],
      );
      expect(lida.rows).toEqual([{ decision: "accepted" }]);

      // "outro_advogado" não vê a decisão nem o caso.
      await db.query("SELECT set_config('app.user_id', 'outro_advogado', false)");
      expect(
        (await db.query("SELECT case_id FROM case_viability WHERE case_id = $1", [caseId])).rows,
      ).toHaveLength(0);
    } finally {
      await db.close();
    }
  });

  it("contratos e parcelas: RLS por caso via join; escalonamento marca 'overdue' só o pendente já vencido", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const otherOffice = crypto.randomUUID();
      const caseId = crypto.randomUUID();
      const caseOutroEscritorio = crypto.randomUUID();
      const contractId = crypto.randomUUID();
      const contractOutroEscritorio = crypto.randomUUID();

      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        otherOffice,
      ]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-CONTR', $2, 'citizen', $3,
         'in_negotiation', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-OUTRO', $2, 'citizen', $3,
         'in_negotiation', now(), now(), now())`,
        [caseOutroEscritorio, crypto.randomUUID(), otherOffice],
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
        "INSERT INTO case_assignments(case_id, lawyer_id, office_id) VALUES ($1, 'lawyer', $2)",
        [caseId, office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('lawyer', 'active', now() + interval '1 month', 'test', 'contr-paid')`,
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'admin')`,
        [contractId, caseId],
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'admin')`,
        [contractOutroEscritorio, caseOutroEscritorio],
      );
      const vencida = crypto.randomUUID();
      const futura = crypto.randomUUID();
      await db.query(
        `INSERT INTO contract_installments(id, contract_id, due_date, amount_cents, status)
         VALUES ($1, $2, current_date - 5, 100000, 'pending')`,
        [vencida, contractId],
      );
      await db.query(
        `INSERT INTO contract_installments(id, contract_id, due_date, amount_cents, status)
         VALUES ($1, $2, current_date + 30, 100000, 'pending')`,
        [futura, contractId],
      );

      await db.exec(
        `CREATE ROLE contrato_tester;
         GRANT SELECT ON contracts TO contrato_tester;
         GRANT SELECT, UPDATE ON contract_installments TO contrato_tester;
         SET ROLE contrato_tester`,
      );
      await db.query("SELECT set_config('app.user_id', 'lawyer', false)");
      expect(
        (await db.query<{ id: string }>("SELECT id FROM contracts ORDER BY id")).rows,
      ).toEqual([{ id: contractId }]); // nunca o contrato do outro escritório

      // Job de manutenção (escalonarParcelasVencidas), fora da RLS — mesma query do serviço.
      await db.exec("RESET ROLE");
      const escaladas = await db.query<{ id: string }>(
        `UPDATE contract_installments SET status = 'overdue'
         WHERE status = 'pending' AND due_date < current_date
         RETURNING id`,
      );
      expect(escaladas.rows).toEqual([{ id: vencida }]);
      const statusParcelas = await db.query<{ id: string; status: string }>(
        "SELECT id, status FROM contract_installments ORDER BY due_date",
      );
      expect(statusParcelas.rows).toEqual([
        { id: vencida, status: "overdue" },
        { id: futura, status: "pending" },
      ]);
    } finally {
      await db.close();
    }
  });

  it("listarContratosEquipe: aba Contratos só traz os do escritório do ator, com protocolo e título do caso", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const otherOffice = crypto.randomUUID();
      const caseId = crypto.randomUUID();
      const caseOutroEscritorio = crypto.randomUUID();
      const contractId = crypto.randomUUID();
      const contractOutroEscritorio = crypto.randomUUID();

      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Outro escritório')", [
        otherOffice,
      ]);
      await db.query(
        `INSERT INTO legal_cases(id, protocol, title, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-LISTA', 'Caso do escritório',
         $2, 'citizen', $3, 'in_negotiation', now(), now(), now())`,
        [caseId, crypto.randomUUID(), office],
      );
      await db.query(
        `INSERT INTO legal_cases(id, protocol, title, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-LISTA-2', 'Caso de outro escritório',
         $2, 'citizen', $3, 'in_negotiation', now(), now(), now())`,
        [caseOutroEscritorio, crypto.randomUUID(), otherOffice],
      );
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)", [
        office,
      ]);
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'admin')`,
        [contractId, caseId],
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by)
         VALUES ($1, $2, 'fixed', 500000, 'admin')`,
        [contractOutroEscritorio, caseOutroEscritorio],
      );

      await db.exec(
        `CREATE ROLE contratos_aba_tester;
         GRANT SELECT ON contracts, legal_cases TO contratos_aba_tester;
         SET ROLE contratos_aba_tester`,
      );
      await db.query("SELECT set_config('app.user_id', 'admin', false)");

      const contratos = await listarContratosEquipe(wrap(db));
      expect(contratos).toEqual([
        expect.objectContaining({
          id: contractId,
          protocol: "JO-LISTA",
          title: "Caso do escritório",
        }),
      ]); // nunca o contrato do outro escritório
    } finally {
      await db.close();
    }
  });
});
