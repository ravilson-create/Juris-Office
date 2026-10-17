import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import type { Db, Queryable } from "@/lib/db/types";
vi.mock("server-only", () => ({}));
const {
  createFinancialEntry,
  settleFinancialEntry,
  cancelFinancialEntry,
  financialSummary,
  financialCashFlow,
  listFinancialEntries,
  importContractInstallment,
} = await import("@/lib/services/financeiro");
const office = "00000000-0000-4000-8000-000000000003";
const otherOffice = "00000000-0000-4000-8000-000000000002";
const db = new PGlite();
const wrap: Db = {
  query: async <T>(sql: string, p?: unknown[]) => (await db.query(sql, p)).rows as T[],
  transaction: async <T>(fn: (tx: Queryable) => Promise<T>) =>
    db.transaction((tx) =>
      fn({ query: async <R>(sql: string, p?: unknown[]) => (await tx.query(sql, p)).rows as R[] }),
    ),
};
const actor = (id: string) => db.query("SELECT set_config('app.user_id',$1,false)", [id]);
const input = (extra = {}) => ({
  requestId: crypto.randomUUID(),
  description: "Honorários",
  counterparty: "Cliente",
  kind: "honorarios" as const,
  direction: "receber" as const,
  amountCents: 10001,
  dueDate: "2026-01-31",
  installments: 1,
  caseId: null,
  notes: "",
  ...extra,
});

describe("Financeiro: isolamento, dinheiro e integridade", () => {
  beforeAll(async () => {
    for (const f of readdirSync("db/migrations")
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort())
      await db.exec(readFileSync(join("db/migrations", f), "utf8"));
    await db.query("INSERT INTO offices(id,name) VALUES ($1,'Outro escritório')", [otherOffice]);
    await db.query("INSERT INTO offices(id,name) VALUES ($1,'Escritório financeiro')", [office]);
    await db.query(
      `INSERT INTO profiles(user_id,role,office_id) VALUES
      ('fin-admin','admin',$1),('fin-staff','staff',$1),('fin-lawyer','lawyer',$1),
      ('fin-other-lawyer','lawyer',$1),('fin-other','admin',$2),('fin-citizen','citizen',NULL)`,
      [office, otherOffice],
    );
    await db.exec(`INSERT INTO lawyer_subscriptions(lawyer_id,status,valid_until,provider) VALUES
      ('fin-admin','active',now()+interval '1 year','test'),('fin-other','active',now()+interval '1 year','test');
      CREATE ROLE finance_tester;
      GRANT SELECT,INSERT,UPDATE ON financial_entries TO finance_tester;
      GRANT SELECT,INSERT ON financial_settlements TO finance_tester;
      GRANT SELECT ON profiles,legal_cases,contract_installments,contracts TO finance_tester;
      GRANT INSERT ON audit_logs TO finance_tester;
      GRANT USAGE ON SEQUENCE audit_logs_id_seq TO finance_tester;
      SET ROLE finance_tester;`);
  }, 60000);
  afterAll(async () => {
    await db.close();
  });

  it("baixas parciais, saldo, idempotência e caixa usam data efetiva", async () => {
    await actor("fin-admin");
    const v = input({ installments: 3 });
    await createFinancialEntry(wrap, "fin-admin", office, v);
    await createFinancialEntry(wrap, "fin-admin", office, v);
    const rows = await listFinancialEntries(wrap, {});
    expect(rows).toHaveLength(3);
    expect(rows.reduce((s, r) => s + Number(r.amount_cents), 0)).toBe(10001);
    const s = {
      id: crypto.randomUUID(),
      entryId: rows[0].id,
      amountCents: 1000,
      paidOn: "2026-01-15",
      note: "Manual",
    };
    await settleFinancialEntry(wrap, "fin-admin", s);
    await settleFinancialEntry(wrap, "fin-admin", s);
    expect((await financialSummary(wrap, {})).receivable).toBe("9001");
    expect((await financialCashFlow(wrap, "2026-01-01", "2026-12-31"))[0].received).toBe("1000");
    await expect(
      settleFinancialEntry(wrap, "fin-admin", {
        ...s,
        id: crypto.randomUUID(),
        amountCents: 100000,
      }),
    ).rejects.toThrow();
    await expect(cancelFinancialEntry(wrap, s.entryId)).rejects.toThrow();
    await expect(
      settleFinancialEntry(wrap, "fin-admin", {
        ...s,
        id: crypto.randomUUID(),
        paidOn: "2999-01-01",
      }),
    ).rejects.toThrow();
  });
  it("nega leitura, baixa e vínculos de outro escritório e clientes", async () => {
    await actor("fin-admin");
    const target = (await listFinancialEntries(wrap, {}))[0];
    for (const id of ["fin-other", "fin-citizen", ""]) {
      await actor(id);
      expect(await listFinancialEntries(wrap, {})).toHaveLength(0);
      expect((await financialSummary(wrap, {})).receivable).toBe("0");
      expect((await db.query("SELECT * FROM financial_settlements")).rows).toHaveLength(0);
      await expect(
        db.query(
          "INSERT INTO financial_settlements(id,entry_id,created_by,amount_cents,paid_on) VALUES ($1,$2,$3,1,'2026-01-01')",
          [crypto.randomUUID(), target.id, id],
        ),
      ).rejects.toThrow();
    }
    await actor("fin-other");
    await expect(createFinancialEntry(wrap, "fin-other", office, input())).rejects.toThrow();
  });
  it("staff registra e baixa, mas não cancela; advogado só vê próprios sem caso", async () => {
    await actor("fin-staff");
    const v = input({
      description: "Despesa",
      kind: "despesa",
      direction: "pagar",
      amountCents: 500,
    });
    await createFinancialEntry(wrap, "fin-staff", office, v);
    const r = (await listFinancialEntries(wrap, { direction: "pagar" }))[0];
    await expect(cancelFinancialEntry(wrap, r.id)).rejects.toThrow();
    await settleFinancialEntry(wrap, "fin-staff", {
      id: crypto.randomUUID(),
      entryId: r.id,
      amountCents: 500,
      paidOn: "2026-02-01",
      note: "Pago",
    });
    expect((await listFinancialEntries(wrap, { direction: "pagar" }))[0].status).toBe("quitado");
    await actor("fin-lawyer");
    expect(await listFinancialEntries(wrap, {})).toHaveLength(0);
    await createFinancialEntry(wrap, "fin-lawyer", office, input({ description: "Conta própria" }));
    expect(await listFinancialEntries(wrap, {})).toHaveLength(1);
    await actor("fin-other-lawyer");
    expect(await listFinancialEntries(wrap, {})).toHaveLength(0);
  });
  it("nega alteração de valores, transferência de escritório e exclusão de histórico", async () => {
    await actor("fin-admin");
    const r = (await listFinancialEntries(wrap, {}))[0];
    await expect(
      db.query("UPDATE financial_entries SET amount_cents=1 WHERE id=$1", [r.id]),
    ).rejects.toThrow();
    await expect(
      db.query("UPDATE financial_entries SET office_id=$2 WHERE id=$1", [r.id, otherOffice]),
    ).rejects.toThrow();
    await expect(db.query("DELETE FROM financial_entries WHERE id=$1", [r.id])).rejects.toThrow();
    await expect(db.query("UPDATE financial_settlements SET amount_cents=1")).rejects.toThrow();
  });
  it("integra cliente/caso e importa parcelas uma vez sem alterar contratos", async () => {
    await db.exec("RESET ROLE");
    const c = crypto.randomUUID(),
      foreign = crypto.randomUUID(),
      contract = crypto.randomUUID(),
      parcel = crypto.randomUUID();
    await db.query(
      `INSERT INTO legal_cases(id,protocol,legal_area_id,office_id,status,created_at,updated_at,applicant)
      VALUES ($1,'FIN-CLIENTE',$3,$4,'active',now(),now(),'{"fullName":"Cliente existente"}'),
      ($2,'FIN-OUTRO',$3,$5,'active',now(),now(),NULL)`,
      [c, foreign, LEGAL_AREAS[0].id, office, otherOffice],
    );
    await db.query(
      "INSERT INTO case_assignments(case_id,lawyer_id,office_id) VALUES ($1,'fin-lawyer',$2)",
      [c, office],
    );
    await db.query(
      "INSERT INTO contracts(id,case_id,fee_type,fee_value_cents,created_by) VALUES ($1,$2,'fixed',2500,'fin-admin')",
      [contract, c],
    );
    await db.query(
      "INSERT INTO contract_installments(id,contract_id,due_date,amount_cents) VALUES ($1,$2,'2026-06-01',2500)",
      [parcel, contract],
    );
    await db.exec("SET ROLE finance_tester");
    await actor("fin-lawyer");
    await importContractInstallment(wrap, "fin-lawyer", office, parcel);
    await importContractInstallment(wrap, "fin-lawyer", office, parcel);
    const rows = await listFinancialEntries(wrap, { caseId: c });
    expect(rows).toHaveLength(1);
    expect(rows[0].counterparty).toBe("Cliente existente");
    await expect(
      createFinancialEntry(wrap, "fin-lawyer", office, input({ caseId: foreign })),
    ).rejects.toThrow();
    await actor("fin-other-lawyer");
    expect(await listFinancialEntries(wrap, { caseId: c })).toHaveLength(0);
    await actor("fin-admin");
    await settleFinancialEntry(wrap, "fin-admin", {
      id: crypto.randomUUID(),
      entryId: rows[0].id,
      amountCents: 2500,
      paidOn: "2026-06-02",
      note: "Manual",
    });
    expect(
      (
        await db.query<{ status: string }>("SELECT status FROM contract_installments WHERE id=$1", [
          parcel,
        ])
      ).rows[0].status,
    ).toBe("pending");
  });
  it("assinatura expirada bloqueia inclusive totais e exportação de dados", async () => {
    await db.exec(
      "RESET ROLE; UPDATE lawyer_subscriptions SET valid_until=now()-interval '1 day' WHERE lawyer_id='fin-admin'; SET ROLE finance_tester;",
    );
    await actor("fin-admin");
    expect(await listFinancialEntries(wrap, {})).toHaveLength(0);
    expect((await financialSummary(wrap, {})).count).toBe("0");
    await expect(createFinancialEntry(wrap, "fin-admin", office, input())).rejects.toThrow();
    await db.exec(
      "RESET ROLE; UPDATE lawyer_subscriptions SET valid_until=now()+interval '1 year' WHERE lawyer_id='fin-admin'; SET ROLE finance_tester;",
    );
  });
  it("áreas atuais são idempotentes e não promovem papéis", async () => {
    await db.exec("RESET ROLE");
    const sql = readFileSync("db/migrations/0037_especialidades_advogados_cadastrados.sql", "utf8");
    const before = (await db.query("SELECT user_id,role FROM profiles ORDER BY user_id")).rows;
    await db.exec(sql);
    await db.exec(sql);
    const areas = (
      await db.query<{ legal_area_id: string }>(
        "SELECT legal_area_id FROM lawyer_areas WHERE lawyer_id='fin-lawyer' ORDER BY legal_area_id",
      )
    ).rows.map((r) => r.legal_area_id);
    expect(areas).toEqual(
      LEGAL_AREAS.filter((a) => a.active)
        .map((a) => a.id)
        .sort(),
    );
    expect((await db.query("SELECT user_id,role FROM profiles ORDER BY user_id")).rows).toEqual(
      before,
    );
    expect(
      (await db.query("SELECT * FROM lawyer_areas WHERE lawyer_id='fin-citizen'")).rows,
    ).toHaveLength(0);
  });
});
