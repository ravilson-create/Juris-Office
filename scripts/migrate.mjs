#!/usr/bin/env node
/**
 * Aplica as migrações de db/migrations/*.sql no banco apontado por DATABASE_URL.
 * Idempotente: cada arquivo roda uma única vez (registrado em schema_migrations), cada um
 * numa transação, com trava de aviso (advisory lock) para dois deploys não migrarem juntos.
 * Sem DATABASE_URL, não faz nada (build local e testes).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Migrações preferem a conexão direta (sem pooler), quando o Neon a fornece.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL ausente: nada a migrar.");
  process.exit(0);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const files = readdirSync(dir)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort();

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
await client.connect();
try {
  // Trava de sessão: só vale numa conexão direta. Com pooler, as migrações usam a URL direta
  // (DATABASE_URL_UNPOOLED) quando existir.
  await client.query("SELECT pg_advisory_lock(727301)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const done = new Set(
    (await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name),
  );
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    // A P2 exige Neon Auth e o papel de execução já configurados. O build da versão
    // anterior pode continuar seguro até a ativação coordenada no ambiente de destino.
    if (/^000[34]_p2_/.test(file) && process.env.ENABLE_P2_AUTH_MIGRATION !== "1") {
      console.log(`[migrate] aguardando ativação: ${file}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`[migrate] aplicada: ${file}`);
      applied++;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`[migrate] falhou em ${file}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode)
    console.log(`[migrate] ok (${applied} nova(s), ${files.length} no total).`);
} finally {
  await client.query("SELECT pg_advisory_unlock(727301)").catch(() => {});
  await client.end();
}
