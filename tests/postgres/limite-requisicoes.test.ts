import { beforeEach, describe, expect, it, vi } from "vitest";
import { BACKEND, PgliteDb, RealPgDb } from "../integration/test-repositories";

vi.mock("server-only", () => ({}));

const { withinRateLimit } = await import("@/lib/rate-limit");

let db: PgliteDb | RealPgDb;

beforeEach(() => {
  db = BACKEND === "pgreal" ? new RealPgDb() : new PgliteDb();
});

describe("limite de requisições", () => {
  it("permite até o limite e recusa a partir dele, na mesma janela", async () => {
    const key = "teste:mesma-janela";
    for (let i = 0; i < 3; i++) {
      expect(await withinRateLimit(db, key, 3, 3600)).toBe(true);
    }
    expect(await withinRateLimit(db, key, 3, 3600)).toBe(false);
    expect(await withinRateLimit(db, key, 3, 3600)).toBe(false);
  });

  it("chaves diferentes têm contadores independentes", async () => {
    expect(await withinRateLimit(db, "teste:chave-a", 1, 3600)).toBe(true);
    expect(await withinRateLimit(db, "teste:chave-a", 1, 3600)).toBe(false);
    expect(await withinRateLimit(db, "teste:chave-b", 1, 3600)).toBe(true);
  });

  it("janelas diferentes (tempo arredondado) não compartilham contagem", async () => {
    const key = "teste:janelas";
    // Janela de 1 segundo: a segunda chamada, ~1.1s depois, cai numa janela nova.
    expect(await withinRateLimit(db, key, 1, 1)).toBe(true);
    expect(await withinRateLimit(db, key, 1, 1)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await withinRateLimit(db, key, 1, 1)).toBe(true);
  });
});
