import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "db/migrations");
const ARQUIVOS = readdirSync(DIR)
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort();
const INDICE_0032 = ARQUIVOS.findIndex((f) => f.startsWith("0032_"));

async function migrarAntesDe0032(db: PGlite) {
  for (const file of ARQUIVOS.slice(0, INDICE_0032)) {
    await db.exec(readFileSync(join(DIR, file), "utf8"));
  }
}

async function migrarDe0032EmDiante(db: PGlite) {
  for (const file of ARQUIVOS.slice(INDICE_0032)) {
    await db.exec(readFileSync(join(DIR, file), "utf8"));
  }
}

/**
 * Migração 0032: contas de advogado criadas antes da 0031 (quando quem assinava nascia 'lawyer',
 * não 'admin') ficaram sem acesso a /equipe, porque office_has_active_subscription só reconhece
 * assinatura de um 'admin' do escritório. A migração promove retroativamente quem tem assinatura
 * própria num escritório sem admin nenhum — mesmo caso real de ravilsonmeireles@gmail.com.
 *
 * Os dados de teste são inseridos ANTES de aplicar a 0032 (migrarAntesDe0032), simulando contas
 * que já existiam quando a migração roda em produção; só então a 0032 é aplicada.
 */
describe("migração 0032: promove advogado legado com assinatura própria", () => {
  it("advogado sozinho no escritório, com assinatura própria, é promovido a admin", async () => {
    const db = new PGlite();
    try {
      await migrarAntesDe0032(db);
      const office = crypto.randomUUID();
      await db.query(`INSERT INTO offices(id, name) VALUES ($1, 'Escritório Teste')`, [office]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('advogado-legado', 'lawyer', $1, 'legado@example.com')`,
        [office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, plano_id)
         VALUES ('advogado-legado', 'active', now() + interval '1 month', 'asaas', 'monthly')`,
      );
      await migrarDe0032EmDiante(db);

      const [perfil] = (
        await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = 'advogado-legado'")
      ).rows;
      expect(perfil!.role).toBe("admin");
    } finally {
      await db.close();
    }
  });

  it("advogado convidado (sem assinatura própria) num escritório com admin não é promovido", async () => {
    const db = new PGlite();
    try {
      await migrarAntesDe0032(db);
      const office = crypto.randomUUID();
      await db.query(`INSERT INTO offices(id, name) VALUES ($1, 'Escritório Teste')`, [office]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES
           ('admin-do-escritorio', 'admin', $1, 'admin@example.com'),
           ('advogado-convidado', 'lawyer', $1, 'convidado@example.com')`,
        [office],
      );
      await db.query(
        `INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, plano_id)
         VALUES ('admin-do-escritorio', 'active', now() + interval '1 month', 'asaas', 'monthly')`,
      );
      await migrarDe0032EmDiante(db);

      const [perfil] = (
        await db.query<{ role: string }>(
          "SELECT role FROM profiles WHERE user_id = 'advogado-convidado'",
        )
      ).rows;
      expect(perfil!.role).toBe("lawyer");
    } finally {
      await db.close();
    }
  });

  it("advogado sem assinatura própria e sem admin no escritório não é promovido", async () => {
    const db = new PGlite();
    try {
      await migrarAntesDe0032(db);
      const office = crypto.randomUUID();
      await db.query(`INSERT INTO offices(id, name) VALUES ($1, 'Escritório Teste')`, [office]);
      await db.query(
        `INSERT INTO profiles(user_id, role, office_id, email) VALUES ('sem-assinatura', 'lawyer', $1, 'x@example.com')`,
        [office],
      );
      await migrarDe0032EmDiante(db);

      const [perfil] = (
        await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = 'sem-assinatura'")
      ).rows;
      expect(perfil!.role).toBe("lawyer");
    } finally {
      await db.close();
    }
  });
});
