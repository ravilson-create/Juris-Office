import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND, PgliteDb, RealPgDb } from "../integration/test-repositories";

vi.mock("server-only", () => ({}));

const { runRetentionCleanup } = await import("@/lib/services/retention");

const AREA = "11111111-1111-4111-8111-111111111111";

let db: PgliteDb | RealPgDb;

beforeEach(() => {
  db = BACKEND === "pgreal" ? new RealPgDb() : new PgliteDb();
});

async function insertCase(opts: {
  status: string;
  updatedAt: string;
  submittedAt?: string | null;
}) {
  const id = randomUUID();
  await db.query(
    `INSERT INTO legal_cases
       (id, protocol, legal_area_id, status, revision, created_at, updated_at, submitted_at)
     VALUES ($1, $2, $3, $4, 0, $5, $5, $6)`,
    [id, `JO-TESTE-${id.slice(0, 8)}`, AREA, opts.status, opts.updatedAt, opts.submittedAt ?? null],
  );
  return id;
}

const DIAS = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe("limpeza periódica", () => {
  it("remove não finalizados com mais de 30 dias, preserva os recentes", async () => {
    const velho = await insertCase({ status: "triage", updatedAt: DIAS(31) });
    const novo = await insertCase({ status: "triage", updatedAt: DIAS(1) });

    const result = await runRetentionCleanup(db);

    expect(result.atendimentosNaoFinalizadosRemovidos).toBe(1);
    expect(await db.query(`SELECT id FROM legal_cases WHERE id = $1`, [velho])).toHaveLength(0);
    expect(await db.query(`SELECT id FROM legal_cases WHERE id = $1`, [novo])).toHaveLength(1);
  });

  it("remove finalizados com mais de 90 dias, preserva os recentes", async () => {
    const velho = await insertCase({
      status: "submitted",
      updatedAt: DIAS(1),
      submittedAt: DIAS(91),
    });
    const novo = await insertCase({
      status: "submitted",
      updatedAt: DIAS(1),
      submittedAt: DIAS(10),
    });

    const result = await runRetentionCleanup(db);

    expect(result.atendimentosFinalizadosRemovidos).toBe(1);
    expect(await db.query(`SELECT id FROM legal_cases WHERE id = $1`, [velho])).toHaveLength(0);
    expect(await db.query(`SELECT id FROM legal_cases WHERE id = $1`, [novo])).toHaveLength(1);
  });

  it("não finalizado recente e finalizado recente sobrevivem juntos", async () => {
    await insertCase({ status: "triage", updatedAt: DIAS(2) });
    await insertCase({ status: "submitted", updatedAt: DIAS(2), submittedAt: DIAS(2) });

    const result = await runRetentionCleanup(db);

    expect(result.atendimentosNaoFinalizadosRemovidos).toBe(0);
    expect(result.atendimentosFinalizadosRemovidos).toBe(0);
    expect(await db.query(`SELECT id FROM legal_cases`)).toHaveLength(2);
  });

  it("apaga em cascata os documentos do caso removido", async () => {
    const caseId = await insertCase({ status: "triage", updatedAt: DIAS(40) });
    await db.query(
      `INSERT INTO case_documents (id, case_id, category, original_name, status, created_at)
       VALUES ($1, $2, 'outros', 'arquivo.pdf', 'pending', now())`,
      [randomUUID(), caseId],
    );

    await runRetentionCleanup(db);

    expect(
      await db.query(`SELECT id FROM case_documents WHERE case_id = $1`, [caseId]),
    ).toHaveLength(0);
  });
});
