import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { listarAdvogadosDisponiveis } = await import("@/lib/services/advogados-disponiveis");

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

const AREA_CONSUMIDOR = "11111111-1111-4111-8111-111111111111";
const AREA_FAMILIA = "22222222-2222-4222-8222-222222222222";

describe("listar_advogados_disponiveis: diretório entre escritórios para o cliente escolher no fim do atendimento", () => {
  it("só traz advogado com OAB confirmada, assinatura ativa e área batendo — de qualquer escritório", async () => {
    const db = await migrarBancoNovo();
    try {
      const officeA = randomUUID();
      const officeB = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório A'), ($2, 'Escritório B')", [
        officeA,
        officeB,
      ]);

      // confirmada, assinatura ativa, área certa — aparece
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, cidade, uf, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('elegivel', 'lawyer', $1, 'São Luís', 'MA', '111111', 'MA', now(), 'elegivel')`,
        [officeA],
      );
      await db.query("INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES ('elegivel', $1)", [
        AREA_CONSUMIDOR,
      ]);
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('elegivel', 'trial', now() + interval '7 days', 'asaas')`,
      );

      // OAB ainda não confirmada — não aparece
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, cidade, uf, oab_numero, oab_uf)
         VALUES ('sem_oab', 'lawyer', $1, 'São Luís', 'MA', '222222', 'MA')`,
        [officeB],
      );
      await db.query("INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES ('sem_oab', $1)", [
        AREA_CONSUMIDOR,
      ]);
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('sem_oab', 'trial', now() + interval '7 days', 'asaas')`,
      );

      // assinatura vencida — não aparece
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, cidade, uf, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('sem_assinatura', 'lawyer', $1, 'São Luís', 'MA', '333333', 'MA', now(), 'sem_assinatura')`,
        [officeB],
      );
      await db.query(
        "INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES ('sem_assinatura', $1)",
        [AREA_CONSUMIDOR],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('sem_assinatura', 'trial', now() - interval '1 day', 'asaas')`,
      );

      // área diferente — não aparece na busca por consumidor
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, cidade, uf, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('outra_area', 'lawyer', $1, 'São Luís', 'MA', '444444', 'MA', now(), 'outra_area')`,
        [officeB],
      );
      await db.query("INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES ('outra_area', $1)", [
        AREA_FAMILIA,
      ]);
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('outra_area', 'trial', now() + interval '7 days', 'asaas')`,
      );

      await db.exec(
        "CREATE ROLE diretorio_tester; GRANT EXECUTE ON FUNCTION listar_advogados_disponiveis(uuid, text) TO diretorio_tester; SET ROLE diretorio_tester",
      );

      const resultado = await listarAdvogadosDisponiveis(wrap(db), AREA_CONSUMIDOR);
      expect(resultado.map((r) => r.lawyer_id)).toEqual(["elegivel"]);
      expect(resultado[0]).toEqual({
        lawyer_id: "elegivel",
        escritorio: "Escritório A",
        cidade: "São Luís",
        uf: "MA",
        oab_numero: "111111",
        oab_uf: "MA",
      });
    } finally {
      await db.close();
    }
  });

  it("filtra por UF quando informado", async () => {
    const db = await migrarBancoNovo();
    try {
      const office = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Escritório')", [office]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, cidade, uf, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
         VALUES ('advogado_ma', 'lawyer', $1, 'São Luís', 'MA', '555555', 'MA', now(), 'advogado_ma'),
                ('advogado_sp', 'lawyer', $1, 'São Paulo', 'SP', '666666', 'SP', now(), 'advogado_sp')`,
        [office],
      );
      await db.query(
        `INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES ('advogado_ma', $1), ('advogado_sp', $1)`,
        [AREA_CONSUMIDOR],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
         VALUES ('advogado_ma', 'trial', now() + interval '7 days', 'asaas'),
                ('advogado_sp', 'trial', now() + interval '7 days', 'asaas')`,
      );

      await db.exec(
        "CREATE ROLE diretorio_uf_tester; GRANT EXECUTE ON FUNCTION listar_advogados_disponiveis(uuid, text) TO diretorio_uf_tester; SET ROLE diretorio_uf_tester",
      );

      const resultado = await listarAdvogadosDisponiveis(wrap(db), AREA_CONSUMIDOR, "ma");
      expect(resultado.map((r) => r.lawyer_id)).toEqual(["advogado_ma"]);
    } finally {
      await db.close();
    }
  });
});
