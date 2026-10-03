import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import type { Db, Queryable } from "@/lib/db/types";

vi.mock("server-only", () => ({}));

const { buscarAdvogadoEscolhido, escolherAdvogado } = await import(
  "@/lib/services/advogados-disponiveis"
);

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
const ANON_HASH_DONO = "a".repeat(64);
const ANON_HASH_OUTRO = "b".repeat(64);

async function criarCasoAnonimo(db: PGlite, areaId: string): Promise<string> {
  const caseId = randomUUID();
  await db.query(
    `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status,
       consent_accepted, revision, created_at, updated_at)
     VALUES ($1, 'JO-ESCOLHA', $2, $3, 'ready_for_review', true, 0, now(), now())`,
    [caseId, areaId, ANON_HASH_DONO],
  );
  return caseId;
}

async function criarAdvogadoElegivel(
  db: PGlite,
  lawyerId: string,
  areaId: string,
): Promise<string> {
  const officeId = randomUUID();
  await db.query("INSERT INTO offices(id, name) VALUES ($1, $2)", [officeId, `Escritório ${lawyerId}`]);
  await db.query(
    `INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
     VALUES ($1, 'lawyer', $2, '123456', 'MA', now(), $1)`,
    [lawyerId, officeId],
  );
  await db.query("INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES ($1, $2)", [
    lawyerId,
    areaId,
  ]);
  await db.query(
    `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider)
     VALUES ($1, 'trial', now() + interval '7 days', 'asaas')`,
    [lawyerId],
  );
  return officeId;
}

describe("escolha de advogado no fim do atendimento (migração 0023)", () => {
  it("cidadão anônimo (dono pela sessão) escolhe um advogado elegível: grava office_id e case_assignments", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = await criarCasoAnonimo(db, AREA_CONSUMIDOR);
      const officeId = await criarAdvogadoElegivel(db, "advogado-elegivel", AREA_CONSUMIDOR);

      await db.exec(
        "CREATE ROLE escolha_tester; GRANT SELECT, UPDATE ON legal_cases TO escolha_tester; GRANT SELECT, INSERT, DELETE ON case_assignments TO escolha_tester; GRANT INSERT ON audit_logs TO escolha_tester; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO escolha_tester; SET ROLE escolha_tester",
      );
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [ANON_HASH_DONO]);

      expect(await buscarAdvogadoEscolhido(wrap(db), caseId)).toBeNull();

      await escolherAdvogado(wrap(db), caseId, "advogado-elegivel");

      const [caso] = (
        await db.query<{ office_id: string }>("SELECT office_id FROM legal_cases WHERE id = $1", [
          caseId,
        ])
      ).rows;
      expect(caso.office_id).toBe(officeId);

      const escolhido = await buscarAdvogadoEscolhido(wrap(db), caseId);
      expect(escolhido).toEqual({ lawyer_id: "advogado-elegivel", escritorio: "Escritório advogado-elegivel" });
    } finally {
      await db.close();
    }
  });

  it("rejeita quando não é dono do atendimento (hash de sessão diferente)", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = await criarCasoAnonimo(db, AREA_CONSUMIDOR);
      await criarAdvogadoElegivel(db, "advogado-elegivel", AREA_CONSUMIDOR);

      await db.exec(
        "CREATE ROLE escolha_outro_tester; GRANT SELECT, UPDATE ON legal_cases TO escolha_outro_tester; GRANT SELECT, INSERT, DELETE ON case_assignments TO escolha_outro_tester; GRANT INSERT ON audit_logs TO escolha_outro_tester; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO escolha_outro_tester; SET ROLE escolha_outro_tester",
      );
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [ANON_HASH_OUTRO]);

      await expect(escolherAdvogado(wrap(db), caseId, "advogado-elegivel")).rejects.toThrow(
        /não encontrado ou sem permissão/,
      );
      expect(await buscarAdvogadoEscolhido(wrap(db), caseId)).toBeNull();
    } finally {
      await db.close();
    }
  });

  it("rejeita advogado sem OAB confirmada, sem assinatura ativa, ou de área diferente", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = await criarCasoAnonimo(db, AREA_CONSUMIDOR);

      // sem OAB confirmada
      const officeSemOab = randomUUID();
      await db.query("INSERT INTO offices(id, name) VALUES ($1, 'Sem OAB')", [officeSemOab]);
      await db.query(
        "INSERT INTO profiles(user_id, role, office_id, oab_numero, oab_uf) VALUES ('sem_oab', 'lawyer', $1, '111', 'MA')",
        [officeSemOab],
      );
      await db.query("INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES ('sem_oab', $1)", [
        AREA_CONSUMIDOR,
      ]);
      await db.query(
        "INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider) VALUES ('sem_oab', 'trial', now() + interval '7 days', 'asaas')",
      );

      // área diferente
      await criarAdvogadoElegivel(db, "outra_area", AREA_FAMILIA);

      await db.exec(
        "CREATE ROLE escolha_invalida_tester; GRANT SELECT, UPDATE ON legal_cases TO escolha_invalida_tester; GRANT SELECT, INSERT, DELETE ON case_assignments TO escolha_invalida_tester; GRANT INSERT ON audit_logs TO escolha_invalida_tester; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO escolha_invalida_tester; SET ROLE escolha_invalida_tester",
      );
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [ANON_HASH_DONO]);

      await expect(escolherAdvogado(wrap(db), caseId, "sem_oab")).rejects.toThrow(/indisponível/);
      await expect(escolherAdvogado(wrap(db), caseId, "outra_area")).rejects.toThrow(/indisponível/);
      await expect(escolherAdvogado(wrap(db), caseId, "nao_existe")).rejects.toThrow(/indisponível/);
    } finally {
      await db.close();
    }
  });

  it("rejeita quando o atendimento ainda não está pronto para revisão", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO legal_cases(id, protocol, legal_area_id, owner_session_hash, status,
           consent_accepted, revision, created_at, updated_at)
         VALUES ($1, 'JO-INCOMPLETO', $2, $3, 'triage', true, 0, now(), now())`,
        [caseId, AREA_CONSUMIDOR, ANON_HASH_DONO],
      );
      await criarAdvogadoElegivel(db, "advogado-elegivel", AREA_CONSUMIDOR);

      await db.exec(
        "CREATE ROLE escolha_incompleto_tester; GRANT SELECT, UPDATE ON legal_cases TO escolha_incompleto_tester; GRANT SELECT, INSERT, DELETE ON case_assignments TO escolha_incompleto_tester; GRANT INSERT ON audit_logs TO escolha_incompleto_tester; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO escolha_incompleto_tester; SET ROLE escolha_incompleto_tester",
      );
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [ANON_HASH_DONO]);

      await expect(escolherAdvogado(wrap(db), caseId, "advogado-elegivel")).rejects.toThrow(
        /não está pronto/,
      );
    } finally {
      await db.close();
    }
  });

  it("escolher de novo substitui a escolha anterior, nunca acumula", async () => {
    const db = await migrarBancoNovo();
    try {
      const caseId = await criarCasoAnonimo(db, AREA_CONSUMIDOR);
      await criarAdvogadoElegivel(db, "primeira_escolha", AREA_CONSUMIDOR);
      const officeSegunda = await criarAdvogadoElegivel(db, "segunda_escolha", AREA_CONSUMIDOR);

      await db.exec(
        "CREATE ROLE escolha_troca_tester; GRANT SELECT, UPDATE ON legal_cases TO escolha_troca_tester; GRANT SELECT, INSERT, DELETE ON case_assignments TO escolha_troca_tester; GRANT INSERT ON audit_logs TO escolha_troca_tester; GRANT USAGE ON SEQUENCE audit_logs_id_seq TO escolha_troca_tester; SET ROLE escolha_troca_tester",
      );
      await db.query("SELECT set_config('app.anon_hash', $1, false)", [ANON_HASH_DONO]);

      await escolherAdvogado(wrap(db), caseId, "primeira_escolha");
      await escolherAdvogado(wrap(db), caseId, "segunda_escolha");

      const atribuicoes = (
        await db.query<{ lawyer_id: string }>(
          "SELECT lawyer_id FROM case_assignments WHERE case_id = $1",
          [caseId],
        )
      ).rows;
      expect(atribuicoes).toEqual([{ lawyer_id: "segunda_escolha" }]);

      const [caso] = (
        await db.query<{ office_id: string }>("SELECT office_id FROM legal_cases WHERE id = $1", [
          caseId,
        ])
      ).rows;
      expect(caso.office_id).toBe(officeSegunda);
    } finally {
      await db.close();
    }
  });
});
