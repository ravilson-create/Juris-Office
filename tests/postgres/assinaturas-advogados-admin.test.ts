import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { listarAssinaturasAdvogados } = await import("@/lib/services/equipe-assinaturas");

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

describe("listarAssinaturasAdvogados: aba do administrador do aplicativo, todos os escritórios", () => {
  it("lista a assinatura de cada advogado, com e-mail e escritório, de qualquer escritório da plataforma", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const officeA = "00000000-0000-4000-8000-000000000001";
      const officeB = crypto.randomUUID();

      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório B')", [officeB]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('lawyer_a', 'lawyer', $1, 'a@escritorio.com')`,
        [officeA],
      );
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('lawyer_b', 'lawyer', $1, 'b@escritorio.com')`,
        [officeB],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref, plano_id)
         VALUES ('lawyer_a', 'trial', now() + interval '7 days', 'asaas', 'sub-a', 'monthly')`,
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref, plano_id)
         VALUES ('lawyer_b', 'active', now() + interval '1 month', 'asaas', 'sub-b', 'yearly')`,
      );

      const linhas = await listarAssinaturasAdvogados(wrap(db));
      expect(linhas).toHaveLength(2);
      expect(linhas.find((l) => l.lawyer_id === "lawyer_a")).toMatchObject({
        email: "a@escritorio.com",
        office_name: "Júris Office",
        status: "trial",
        plano_id: "monthly",
      });
      expect(linhas.find((l) => l.lawyer_id === "lawyer_b")).toMatchObject({
        email: "b@escritorio.com",
        office_name: "Escritório B",
        status: "active",
        plano_id: "yearly",
      });
    } finally {
      await db.close();
    }
  });
});
