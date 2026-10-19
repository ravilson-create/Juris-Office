import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const fake = vi.hoisted(() => ({
  query: vi.fn(async (_text: string, _params?: unknown[]) => ({ rows: [] as unknown[] })),
  release: vi.fn(),
  getUser: vi.fn(async () => "from-cookie"),
  getAnon: vi.fn(async () => "b".repeat(64)),
}));
vi.mock("pg", () => ({
  Pool: class {
    on() {}
    async connect() { return { query: fake.query, release: fake.release }; }
    async query() { return { rows: [] }; }
  },
}));
vi.mock("@/lib/auth/session", () => ({ authEnabled: true, currentUserId: fake.getUser }));
vi.mock("@/lib/auth/case-access", () => ({ currentAnonHash: fake.getAnon }));

const { PgDb } = await import("@/lib/db/pg-db");
const { runWithDbSession, currentDbSession } = await import("@/lib/db/session-context");

beforeEach(() => {
  fake.query.mockClear();
  fake.getUser.mockClear();
  fake.getAnon.mockClear();
  fake.release.mockClear();
});

describe("PgDb: identidade vinculada à mesma transação RLS", () => {
  it("usa o hash da Server Action sem tentar reler um cookie recém-gravado", async () => {
    const anon = "a".repeat(64);
    const db = new PgDb("postgresql://teste@localhost/base");
    await runWithDbSession({ userId: null, anonHash: anon }, () =>
      db.query("INSERT INTO legal_cases (id) VALUES ('teste')"),
    );
    expect(fake.query).toHaveBeenCalledWith(
      "SELECT set_config('app.user_id', $1, true), set_config('app.anon_hash', $2, true)",
      ["", anon],
    );
    expect(fake.getUser).not.toHaveBeenCalled();
    expect(fake.getAnon).not.toHaveBeenCalled();
    expect(currentDbSession()).toBeUndefined();
    expect(fake.release).toHaveBeenCalledTimes(1);
  });
  it("preserva o caminho normal para outras operações autenticadas", async () => {
    const db = new PgDb("postgresql://teste@localhost/base");
    await db.query("SELECT 1");
    expect(fake.query).toHaveBeenCalledWith(
      "SELECT set_config('app.user_id', $1, true), set_config('app.anon_hash', $2, true)",
      ["from-cookie", "b".repeat(64)],
    );
    expect(fake.getUser).toHaveBeenCalledTimes(1);
    expect(fake.getAnon).toHaveBeenCalledTimes(1);
  });
  it("usa a identidade de conta logada quando fornecida pela Server Action", async () => {
    const db = new PgDb("postgresql://teste@localhost/base");
    await runWithDbSession({ userId: "user-neon", anonHash: null }, () => db.query("SELECT 1"));
    expect(fake.query).toHaveBeenCalledWith(
      "SELECT set_config('app.user_id', $1, true), set_config('app.anon_hash', $2, true)",
      ["user-neon", ""],
    );
  });
});
