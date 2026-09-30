import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generateProtocol } from "@/domain/case/protocol";
const state = vi.hoisted(() => ({
  actor: "guest:owner",
  payments: [] as {
    id: string;
    subscription: string;
    status: string;
    dueDate: string;
    value: number;
    invoiceUrl?: string;
  }[],
}));
let db: PGlite;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ currentActorId: async () => state.actor }));
vi.mock("@/lib/db/private", () => ({
  privateQuery: async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows,
  privateTransaction: async (
    fn: (tx: {
      query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    }) => Promise<unknown>,
  ) =>
    db.transaction(async (tx) =>
      fn({ query: async (sql, params) => (await tx.query(sql, params)).rows }),
    ),
}));
vi.mock("@/lib/billing/asaas", () => ({
  payments: async () => state.payments,
  asaas: vi.fn(),
  safeInvoiceUrl: (s: string) => s ?? null,
}));
const { issueTrackingToken, lookupTrackingToken } = await import("@/lib/tracking");
const { handleBillingEvent } = await import("@/lib/billing/service");
const office = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  for (const file of readdirSync("db/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(join("db/migrations", file), "utf8"));
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  state.actor = "guest:owner";
  state.payments = [];
  await db.exec("TRUNCATE legal_cases,profiles,billing_events CASCADE");
});
describe("consulta e cobrança isoladas", () => {
  it("o protocolo do pedido consulta apenas andamento, sem dados pessoais nem notas internas", async () => {
    const id = crypto.randomUUID(),
      protocol = generateProtocol();
    await db.query(
      `INSERT INTO legal_cases(id,protocol,legal_area_id,citizen_id,status,submitted_at,narrative,created_at,updated_at) VALUES($1,$2,$3,'guest:owner','submitted',now(),'SEGREDO',now(),now())`,
      [id, protocol, crypto.randomUUID()],
    );
    expect(await issueTrackingToken(id)).toBe(protocol);
    state.actor = "guest:other";
    await expect(issueTrackingToken(id)).rejects.toThrow();
    const result = await lookupTrackingToken(protocol);
    expect(result?.status).toBe("submitted");
    expect(JSON.stringify(result)).not.toContain("SEGREDO");
    expect(await lookupTrackingToken(generateProtocol())).toBeNull();
    expect(await lookupTrackingToken("JO-20260930-234567")).toBeNull();
    await db.query(
      `INSERT INTO case_public_updates(id,case_id,status,message,actor_id) VALUES($1,$2,'under_legal_review','Análise iniciada','lawyer')`,
      [crypto.randomUUID(), id],
    );
    expect((await lookupTrackingToken(protocol))?.updates[0].message).toBe("Análise iniciada");
  });
  it("webhook é idempotente, reconsulta o gateway e conserva período pago após cancelamento", async () => {
    await db.query(`INSERT INTO profiles(user_id,role,office_id) VALUES('lawyer','lawyer',$1)`, [
      office,
    ]);
    await db.exec(
      `INSERT INTO billing_accounts(lawyer_id,plan_id,subscription_id) VALUES('lawyer','monthly','sub_test')`,
    );
    state.payments = [
      {
        id: "pay1",
        subscription: "sub_test",
        status: "CONFIRMED",
        dueDate: new Date().toISOString().slice(0, 10),
        value: 39.9,
      },
    ];
    await handleBillingEvent("evt1", "PAYMENT_CONFIRMED", "sub_test");
    await handleBillingEvent("evt1", "PAYMENT_CONFIRMED", "sub_test");
    expect((await db.query("SELECT * FROM billing_events")).rows).toHaveLength(1);
    expect(
      (await db.query<{ status: string }>("SELECT status FROM lawyer_subscriptions")).rows[0]
        .status,
    ).toBe("active");
    // Evento atrasado não revoga o pagamento já confirmado no gateway.
    await handleBillingEvent("evt2", "PAYMENT_OVERDUE", "sub_test");
    expect(
      (await db.query<{ status: string }>("SELECT status FROM lawyer_subscriptions")).rows[0]
        .status,
    ).toBe("active");
    await handleBillingEvent("evt3", "SUBSCRIPTION_INACTIVATED", "sub_test");
    expect(
      (
        await db.query<{ cancel_requested: boolean }>(
          "SELECT cancel_requested FROM billing_accounts",
        )
      ).rows[0].cancel_requested,
    ).toBe(true);
    expect(
      (await db.query<{ status: string }>("SELECT status FROM lawyer_subscriptions")).rows[0]
        .status,
    ).toBe("active");
    state.payments[0].status = "REFUNDED";
    await handleBillingEvent("evt4", "PAYMENT_REFUNDED", "sub_test");
    expect(
      (await db.query<{ status: string }>("SELECT status FROM lawyer_subscriptions")).rows[0]
        .status,
    ).toBe("canceled");
  });
  it("falha de processamento não confirma o evento e permite reentrega", async () => {
    await expect(handleBillingEvent("retry", "PAYMENT_CREATED", "missing")).rejects.toThrow();
    expect((await db.query("SELECT * FROM billing_events")).rows).toHaveLength(0);
  });
});
