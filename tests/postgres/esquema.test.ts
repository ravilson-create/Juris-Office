import { beforeEach, describe, expect, it } from "vitest";
import { MAX_DOCUMENTS_PER_CASE } from "@/domain/document/rules";
import { InProcessCaseLock } from "@/lib/services/case-lock";
import { CaseService } from "@/lib/services/case-service";
import { PgCaseRepository } from "@/lib/repositories/pg/case-repository";
import { ProtocolConflictError, type Repositories } from "@/lib/repositories/types";
import {
  BACKEND,
  PgliteDb,
  RealPgDb,
  createTestRepositories,
} from "../integration/test-repositories";
import { pdf, readyConsumidorCase } from "../integration/fixtures";

const NOW = new Date("2026-09-27T15:00:00Z");
const AREA = "11111111-1111-4111-8111-111111111111";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

let db: PgliteDb | RealPgDb;
let repos: Repositories;
let service: CaseService;

beforeEach(() => {
  // PgliteDb novo zera as tabelas; os repositórios usam a mesma instância.
  db = BACKEND === "pgreal" ? new RealPgDb() : new PgliteDb();
  repos = createTestRepositories();
  service = new CaseService(repos, () => NOW, new InProcessCaseLock());
});

it("estas suítes rodam mesmo contra PostgreSQL", () => {
  expect(["pg", "pgreal"]).toContain(BACKEND);
  expect(repos.cases).toBeInstanceOf(PgCaseRepository);
});

describe("restrições do esquema", () => {
  it("protocolo é único; o serviço gera outro em colisão", async () => {
    await repos.cases.create({ legalAreaId: AREA, protocol: "JO-20260927-AAAAAA" });
    await expect(
      repos.cases.create({ legalAreaId: AREA, protocol: "JO-20260927-AAAAAA" }),
    ).rejects.toBeInstanceOf(ProtocolConflictError);
    // O serviço tenta de novo com outro protocolo.
    const c = await service.createCase("consumidor");
    expect(c.protocol).toMatch(/^JO-\d{8}-[A-Z0-9]{28}$/);
  });

  it("dossiê: (caso, versão) é único no banco", async () => {
    const c = await readyConsumidorCase(service);
    const { dossier } = await service.submitCase(c.id);
    await expect(
      db.query(
        `INSERT INTO dossiers (id, case_id, version, payload, created_at) VALUES ($1, $2, 1, '{}', now())`,
        [crypto.randomUUID(), c.id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    expect((await repos.dossiers.findLatest(c.id))?.id).toBe(dossier.id);
  });

  it("banco recusa status inválido, hash de sessão malformado e 'submitted' sem data", async () => {
    const c = await repos.cases.create({ legalAreaId: AREA, protocol: "JO-20260927-BBBBBB" });
    await expect(
      db.query(`UPDATE legal_cases SET status = 'qualquer' WHERE id = $1`, [c.id]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query(`UPDATE legal_cases SET owner_session_hash = 'curto' WHERE id = $1`, [c.id]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query(`UPDATE legal_cases SET status = 'submitted' WHERE id = $1`, [c.id]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      db.query(`UPDATE legal_cases SET submitted_at = now() WHERE id = $1`, [c.id]),
    ).rejects.toMatchObject({ code: "23514" }); // ainda "draft"
  });

  it("filhos exigem caso existente e somem junto com ele (CASCADE)", async () => {
    await expect(
      db.query(
        `INSERT INTO case_documents (id, case_id, category, original_name, status, created_at)
         VALUES ($1, $1, 'x', 'a.pdf', 'uploaded', now())`,
        [crypto.randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23503" });

    const c = await readyConsumidorCase(service);
    await service.addDocument(c.id, pdf("a.pdf"));
    await service.saveDraft(
      c.id,
      "relato",
      { narrative: "x" },
      { formKey: crypto.randomUUID(), seq: 1, baseTime: NOW.toISOString() },
    );
    await service.submitCase(c.id);
    await db.query(`DELETE FROM legal_cases WHERE id = $1`, [c.id]);
    for (const t of [
      "triage_answers",
      "case_documents",
      "dossiers",
      "case_drafts",
      "case_draft_commits",
    ]) {
      const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`);
      expect(n, t).toBe(0);
    }
  });
});

describe("garantias sob concorrência (PostgreSQL)", () => {
  it("40 inclusões simultâneas de documentos: exatamente 20 registros", async () => {
    const c = await readyConsumidorCase(service);
    const tabs = Array.from(
      { length: 40 },
      () => new CaseService(repos, () => NOW, new InProcessCaseLock()),
    );
    await Promise.allSettled(tabs.map((t, i) => t.addDocument(c.id, pdf(`d${i}.pdf`))));
    const [{ n }] = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM case_documents WHERE case_id = $1`,
      [c.id],
    );
    expect(n).toBe(MAX_DOCUMENTS_PER_CASE);
  });

  it("20 finalizações simultâneas: um dossiê e o caso 'submitted' com a mesma data", async () => {
    const c = await readyConsumidorCase(service);
    const tabs = Array.from(
      { length: 20 },
      () => new CaseService(repos, () => NOW, new InProcessCaseLock()),
    );
    const results = await Promise.allSettled(tabs.map((t) => t.submitCase(c.id)));
    expect(
      new Set(results.filter((r) => r.status === "fulfilled").map((r) => r.value.dossier.id)).size,
    ).toBe(1);
    const [{ n }] = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM dossiers WHERE case_id = $1`,
      [c.id],
    );
    expect(n).toBe(1);
    const [row] = await db.query<{ status: string; submitted_at: Date }>(
      `SELECT status, submitted_at FROM legal_cases WHERE id = $1`,
      [c.id],
    );
    expect(row.status).toBe("submitted");
    expect(row.submitted_at.toISOString()).toBe(NOW.toISOString());
  });

  it("revisão incrementa a cada alteração de conteúdo", async () => {
    const c = await service.createCase("consumidor");
    expect(c.revision).toBe(0);
    const [{ revision }] = await db.query<{ revision: number }>(
      `SELECT revision FROM legal_cases WHERE id = $1`,
      [c.id],
    );
    expect(revision).toBe(0);
    await service.saveApplicant(c.id, {
      fullName: "Maria da Silva",
      email: "m@example.com",
      phone: "11912345678",
      city: "Campinas",
      uf: "SP",
      consentAccepted: true,
    });
    const [after] = await db.query<{ revision: number }>(
      `SELECT revision FROM legal_cases WHERE id = $1`,
      [c.id],
    );
    expect(after.revision).toBeGreaterThan(0);
  });
});

describe("isolamento por sessão", () => {
  it("listByOwner devolve só os casos do dono", async () => {
    const a = await service.createCase("consumidor", HASH_A);
    await service.createCase("civel", HASH_B);
    const mine = await service.listMyCases(HASH_A);
    expect(mine.map((i) => i.id)).toEqual([a.id]);
    expect(await service.listMyCases("c".repeat(64))).toEqual([]);
  });
});
