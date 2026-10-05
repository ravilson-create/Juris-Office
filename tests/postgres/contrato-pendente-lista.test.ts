import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { listarCasosComContratoPendente } = await import("@/lib/services/equipe-contratos");

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

/**
 * Testa listarCasosComContratoPendente (lib/services/equipe-contratos.ts), usada em
 * "Meus atendimentos" (app/atendimento/meus/page.tsx) para avisar o cliente sobre contrato
 * esperando assinatura, sem precisar abrir o dossiê de cada atendimento.
 */
describe("listarCasosComContratoPendente", () => {
  it("retorna só os casos com contrato status 'sent', ignorando draft/signed/cancelled e casos de fora da lista", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      const areaId = crypto.randomUUID();

      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('lawyer', 'lawyer', $1, '123456', 'MA', now(), 'lawyer')`,
        [office],
      );

      const casoEnviado = crypto.randomUUID();
      const casoRascunho = crypto.randomUUID();
      const casoAssinado = crypto.randomUUID();
      const casoFora = crypto.randomUUID();

      for (const [id, protocolo] of [
        [casoEnviado, "JO-1"],
        [casoRascunho, "JO-2"],
        [casoAssinado, "JO-3"],
        [casoFora, "JO-4"],
      ]) {
        await db.query(
          `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
           status, submitted_at, created_at, updated_at) VALUES ($1, $2, $3, 'citizen', $4,
           'under_legal_review', now(), now(), now())`,
          [id, protocolo, areaId, office],
        );
      }

      const content = { clausulas: [] };
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by, content, status)
         VALUES ($1, $2, 'fixed', 100000, 'lawyer', $3, 'sent')`,
        [crypto.randomUUID(), casoEnviado, JSON.stringify(content)],
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by, content, status)
         VALUES ($1, $2, 'fixed', 100000, 'lawyer', $3, 'draft')`,
        [crypto.randomUUID(), casoRascunho, JSON.stringify(content)],
      );
      await db.query(
        `INSERT INTO contracts(id, case_id, fee_type, fee_value_cents, created_by, content, status)
         VALUES ($1, $2, 'fixed', 100000, 'lawyer', $3, 'signed')`,
        [crypto.randomUUID(), casoAssinado, JSON.stringify(content)],
      );

      const pendentes = await listarCasosComContratoPendente(wrap(db), [
        casoEnviado,
        casoRascunho,
        casoAssinado,
      ]);

      expect(pendentes).toEqual(new Set([casoEnviado]));
    } finally {
      await db.close();
    }
  });

  it("lista vazia de ids não consulta o banco e retorna conjunto vazio", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const pendentes = await listarCasosComContratoPendente(wrap(db), []);
      expect(pendentes).toEqual(new Set());
    } finally {
      await db.close();
    }
  });
});
