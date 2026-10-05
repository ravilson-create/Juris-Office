import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { contarCasosFila, listarCasosFila } = await import("@/lib/services/equipe-fila");

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

describe("fila do advogado: arquivados ficam fora por padrão (migração 0018)", () => {
  it("contarCasosFila e listarCasosFila só trazem arquivados quando pedido", async () => {
    const pglite = new PGlite();
    try {
      const dir = join(process.cwd(), "db/migrations");
      for (const file of readdirSync(dir)
        .filter((f) => /^\d+_.*\.sql$/.test(f))
        .sort()) {
        await pglite.exec(readFileSync(join(dir, file), "utf8"));
      }
      const office = randomUUID();
      const ativo = randomUUID();
      const arquivado = randomUUID();
      await pglite.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório')", [office]);
      await pglite.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at) VALUES ($1, 'JO-FILA-A', $2, 'citizen', $3,
         'active', now(), now(), now())`,
        [ativo, AREA, office],
      );
      await pglite.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, citizen_id, office_id,
         status, submitted_at, created_at, updated_at, archived_at)
         VALUES ($1, 'JO-FILA-B', $2, 'citizen', $3, 'active', now(), now(), now(), now())`,
        [arquivado, AREA, office],
      );
      await pglite.query(
        "INSERT INTO profiles(user_id, role, office_id) VALUES ('admin', 'admin', $1)",
        [office],
      );
      await pglite.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, external_ref)
         VALUES ('admin', 'active', now() + interval '1 month', 'test', 'fila-arq-admin')`,
      );
      await pglite.exec(
        "CREATE ROLE fila_arq; GRANT SELECT ON legal_cases TO fila_arq; SET ROLE fila_arq",
      );
      await pglite.query("SELECT set_config('app.user_id', 'admin', false)");

      const db = wrap(pglite);
      const filtroPadrao = { status: null, busca: "" };
      expect(await contarCasosFila(db, filtroPadrao)).toBe(1);
      expect((await listarCasosFila(db, filtroPadrao, 20, 0)).map((c) => c.id)).toEqual([ativo]);

      const filtroArquivados = { status: null, busca: "", arquivados: true };
      expect(await contarCasosFila(db, filtroArquivados)).toBe(1);
      expect((await listarCasosFila(db, filtroArquivados, 20, 0)).map((c) => c.id)).toEqual([
        arquivado,
      ]);
    } finally {
      await pglite.close();
    }
  });
});
