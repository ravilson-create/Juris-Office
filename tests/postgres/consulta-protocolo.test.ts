import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";
import { areaId } from "@/lib/mocks/legal-areas";

vi.mock("server-only", () => ({}));

const { consultarAtendimentoPorProtocolo } = await import("@/lib/services/consulta-protocolo");

async function migrarBancoNovo(): Promise<PGlite> {
  const db = new PGlite();
  const dir = join(process.cwd(), "db/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
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

const AREA_CONSUMIDOR = areaId("consumidor");
const CPF = "11144477735";

describe("consultarAtendimentoPorProtocolo: consulta pública por protocolo + CPF", () => {
  it("atendimento ainda em preenchimento: acha pelo protocolo+CPF certos, sem dossiê", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, applicant,
           consent_accepted, revision, created_at, updated_at)
         VALUES ($1, 'JO-20260101-ABCDEF', $2, $3, 'ready_for_review', $4::jsonb, true, 0, now(), now())`,
        [caseId, AREA_CONSUMIDOR, "a".repeat(64), JSON.stringify({ cpf: CPF, fullName: "Fulano" })],
      );

      const resultado = await consultarAtendimentoPorProtocolo(wrap(db), "JO-20260101-ABCDEF", CPF);
      expect(resultado).toEqual({
        protocol: "JO-20260101-ABCDEF",
        areaName: "Consumidor",
        statusLabel: expect.any(String),
        updatedAt: expect.anything(),
        finalized: false,
        dossier: null,
      });
    } finally {
      await db.close();
    }
  });

  it("atendimento finalizado: traz o dossiê mais recente", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, applicant,
           consent_accepted, revision, created_at, updated_at, submitted_at)
         VALUES ($1, 'JO-20260101-FINALZ', $2, $3, 'submitted', $4::jsonb, true, 0, now(), now(), now())`,
        [caseId, AREA_CONSUMIDOR, "a".repeat(64), JSON.stringify({ cpf: CPF, fullName: "Fulano" })],
      );
      const dossierPayload = { id: randomUUID(), caseId, version: 1, protocol: "JO-20260101-FINALZ" };
      await db.query(
        `INSERT INTO dossiers(id, case_id, version, payload, created_at) VALUES ($1, $2, 1, $3::jsonb, now())`,
        [randomUUID(), caseId, JSON.stringify(dossierPayload)],
      );

      const resultado = await consultarAtendimentoPorProtocolo(wrap(db), "JO-20260101-FINALZ", CPF);
      expect(resultado?.finalized).toBe(true);
      expect(resultado?.dossier).toEqual(dossierPayload);
    } finally {
      await db.close();
    }
  });

  it("CPF errado, protocolo inexistente, ou aplicante sem CPF: sempre null, nunca revela qual", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status, applicant,
           consent_accepted, revision, created_at, updated_at)
         VALUES ($1, 'JO-20260101-CERTOC', $2, $3, 'ready_for_review', $4::jsonb, true, 0, now(), now())`,
        [caseId, AREA_CONSUMIDOR, "a".repeat(64), JSON.stringify({ cpf: CPF, fullName: "Fulano" })],
      );
      const semCpfId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status,
           consent_accepted, revision, created_at, updated_at)
         VALUES ($1, 'JO-20260101-SEMCPF', $2, $3, 'draft', true, 0, now(), now())`,
        [semCpfId, AREA_CONSUMIDOR, "b".repeat(64)],
      );

      expect(
        await consultarAtendimentoPorProtocolo(wrap(db), "JO-20260101-CERTOC", "99999999999"),
      ).toBeNull();
      expect(
        await consultarAtendimentoPorProtocolo(wrap(db), "JO-20269999-NADAAA", CPF),
      ).toBeNull();
      expect(
        await consultarAtendimentoPorProtocolo(wrap(db), "JO-20260101-SEMCPF", CPF),
      ).toBeNull();
    } finally {
      await db.close();
    }
  });
});
