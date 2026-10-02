import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { iniciarAnaliseSeNecessario, registrarViabilidade } = await import(
  "@/lib/services/equipe-contratos"
);

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

const AREA = "11111111-1111-4111-8111-111111111111";

/**
 * Regressão: sem iniciarAnaliseSeNecessario, nenhum caso finalizado ("submitted") conseguia
 * sair desse status — registrarViabilidade só aceita a transição a partir de
 * "under_legal_review" (ver domain/case/status.ts), e nada mais movia o caso para lá. Todo
 * teste anterior de viabilidade já partia de um caso pré-semeado em "under_legal_review",
 * mascarando o problema.
 */
describe("Caso finalizado entra em análise automaticamente ao ser aberto pelo profissional", () => {
  it("iniciarAnaliseSeNecessario move 'submitted' para 'under_legal_review', e só esse status", async () => {
    const pglite = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await pglite.exec(readFileSync(join(dir, file), "utf8"));
      }
      const office = randomUUID();
      const finalizado = randomUUID();
      const rascunho = randomUUID();
      await pglite.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório')", [office]);
      await pglite.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-AN-1', $2, 'citizen', $3,
         'submitted', now(), now(), now())`,
        [finalizado, AREA, office],
      );
      await pglite.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, created_at, updated_at) VALUES ($1, 'JO-AN-2', $2, 'citizen', $3, 'draft', now(), now())`,
        [rascunho, AREA, office],
      );

      const db = wrap(pglite);
      expect(await iniciarAnaliseSeNecessario(db, finalizado, "submitted")).toBe(
        "under_legal_review",
      );
      const [row] = (
        await pglite.query<{ status: string }>("SELECT status FROM legal_cases WHERE id = $1", [
          finalizado,
        ])
      ).rows;
      expect(row.status).toBe("under_legal_review");

      // Um rascunho não é afetado — a função só age sobre "submitted".
      expect(await iniciarAnaliseSeNecessario(db, rascunho, "draft")).toBe("draft");
      const [rowRascunho] = (
        await pglite.query<{ status: string }>("SELECT status FROM legal_cases WHERE id = $1", [
          rascunho,
        ])
      ).rows;
      expect(rowRascunho.status).toBe("draft");
    } finally {
      await pglite.close();
    }
  });

  it("depois de iniciarAnaliseSeNecessario, a decisão de viabilidade é aceita (antes falhava)", async () => {
    const pglite = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await pglite.exec(readFileSync(join(dir, file), "utf8"));
      }
      const office = randomUUID();
      const caseId = randomUUID();
      await pglite.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório')", [office]);
      await pglite.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-AN-3', $2, 'citizen', $3,
         'submitted', now(), now(), now())`,
        [caseId, AREA, office],
      );
      await pglite.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)",
        [office],
      );
      const db = wrap(pglite);

      const novoStatus = await iniciarAnaliseSeNecessario(db, caseId, "submitted");
      await registrarViabilidade(db, {
        caseId,
        feasibilityNote: "Causa viável, documentação completa.",
        risk: "low",
        decision: "accepted",
        decidedBy: "admin",
        statusAtual: novoStatus,
      });

      const [row] = (
        await pglite.query<{ status: string }>("SELECT status FROM legal_cases WHERE id = $1", [
          caseId,
        ])
      ).rows;
      expect(row.status).toBe("accepted");
    } finally {
      await pglite.close();
    }
  });
});
