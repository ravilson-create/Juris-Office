import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { acessoEquipe } = await import("@/lib/auth/equipe-acesso");

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

const OFFICE = "00000000-0000-4000-8000-000000000001";
const ANTES = process.env.JURIS_ADMIN_EMAIL;

describe("acessoEquipe: dono do app não fica preso em /assinatura", () => {
  afterEach(() => {
    process.env.JURIS_ADMIN_EMAIL = ANTES;
  });

  it("admin bootstrapado como dono do app (sem linha em lawyer_subscriptions) tem acesso", async () => {
    process.env.JURIS_ADMIN_EMAIL = "dono@jurisoffice.com.br";
    const pg = await migrarBancoNovo();
    try {
      await pg.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('dono', 'admin', $1, 'dono@jurisoffice.com.br')`,
        [OFFICE],
      );
      const acesso = await acessoEquipe(wrap(pg), "dono");
      expect(acesso).toEqual({
        ok: true,
        role: "admin",
        officeId: OFFICE,
        oabConfirmada: false,
      });
    } finally {
      await pg.close();
    }
  });

  it("admin comum (não é o dono do app) sem assinatura do escritório é bloqueado", async () => {
    process.env.JURIS_ADMIN_EMAIL = "dono@jurisoffice.com.br";
    const pg = await migrarBancoNovo();
    try {
      await pg.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('outro-admin', 'admin', $1, 'outro@example.com')`,
        [OFFICE],
      );
      const acesso = await acessoEquipe(wrap(pg), "outro-admin");
      expect(acesso).toEqual({ ok: false, motivo: "sem_assinatura" });
    } finally {
      await pg.close();
    }
  });
});
