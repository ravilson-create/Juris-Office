import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

async function migrar(db: PGlite) {
  const dir = join(process.cwd(), "db/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
}

describe("consumir_auxilio_ia / auxilios_ia_restantes: cota mensal de 100 por advogado", () => {
  it("consome até 100 no mês, a 101ª chamada é negada, e é isolada por advogado", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const office = "00000000-0000-4000-8000-000000000001";
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('lawyer_a', 'lawyer', $1)", [
        office,
      ]);
      await db.query("INSERT INTO profiles(user_id, role, office_id) VALUES ('lawyer_b', 'lawyer', $1)", [
        office,
      ]);

      await db.query("SELECT set_config('app.user_id', 'lawyer_a', false)");
      for (let i = 0; i < 100; i++) {
        const { rows } = await db.query<{ consumir_auxilio_ia: boolean }>(
          "SELECT consumir_auxilio_ia()",
        );
        expect(rows[0]!.consumir_auxilio_ia).toBe(true);
      }
      const restantesZero = await db.query<{ auxilios_ia_restantes: number }>(
        "SELECT auxilios_ia_restantes()",
      );
      expect(restantesZero.rows[0]!.auxilios_ia_restantes).toBe(0);

      const negada = await db.query<{ consumir_auxilio_ia: boolean }>(
        "SELECT consumir_auxilio_ia()",
      );
      expect(negada.rows[0]!.consumir_auxilio_ia).toBe(false);

      // outro advogado começa do zero — a cota não é compartilhada entre advogados.
      await db.query("SELECT set_config('app.user_id', 'lawyer_b', false)");
      const restantesB = await db.query<{ auxilios_ia_restantes: number }>(
        "SELECT auxilios_ia_restantes()",
      );
      expect(restantesB.rows[0]!.auxilios_ia_restantes).toBe(100);
      const permitidoB = await db.query<{ consumir_auxilio_ia: boolean }>(
        "SELECT consumir_auxilio_ia()",
      );
      expect(permitidoB.rows[0]!.consumir_auxilio_ia).toBe(true);
    } finally {
      await db.close();
    }
  });

  it("sem sessão autenticada, nunca consome e sempre mostra zero restante", async () => {
    const db = new PGlite();
    try {
      await migrar(db);
      const consumir = await db.query<{ consumir_auxilio_ia: boolean }>(
        "SELECT consumir_auxilio_ia()",
      );
      expect(consumir.rows[0]!.consumir_auxilio_ia).toBe(false);
      const restantes = await db.query<{ auxilios_ia_restantes: number }>(
        "SELECT auxilios_ia_restantes()",
      );
      expect(restantes.rows[0]!.auxilios_ia_restantes).toBe(0);
    } finally {
      await db.close();
    }
  });
});
