import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const setSpy = vi.fn((name: string, value: string) => jar.set(name, value));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: setSpy,
  }),
}));

const { canAccessCase, ensureSessionHash, hashSession, SESSION_COOKIE } =
  await import("@/lib/auth/case-access");

beforeEach(() => {
  jar.clear();
  setSpy.mockClear();
});

describe("acesso ao atendimento por sessão do navegador", () => {
  it("cria sessão em cookie httpOnly e devolve apenas o hash", async () => {
    const hash = await ensureSessionHash();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(setSpy).toHaveBeenCalledWith(
      SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    const sessionId = jar.get(SESSION_COOKIE)!;
    expect(hash).toBe(hashSession(sessionId));
    expect(hash).not.toContain(sessionId);
  });

  it("reaproveita a sessão existente", async () => {
    const a = await ensureSessionHash();
    const b = await ensureSessionHash();
    expect(a).toBe(b);
    expect(setSpy).toHaveBeenCalledTimes(1);
  });

  it("permite o dono e bloqueia outro navegador", async () => {
    const owner = await ensureSessionHash();
    expect(await canAccessCase({ ownerSessionHash: owner })).toBe(true);
    jar.set(SESSION_COOKIE, crypto.randomUUID()); // outro navegador
    expect(await canAccessCase({ ownerSessionHash: owner })).toBe(false);
  });

  it("bloqueia sem cookie, com cookie adulterado ou caso sem dono", async () => {
    const owner = await ensureSessionHash();
    jar.clear();
    expect(await canAccessCase({ ownerSessionHash: owner })).toBe(false);
    jar.set(SESSION_COOKIE, "nao-e-um-uuid");
    expect(await canAccessCase({ ownerSessionHash: owner })).toBe(false);
    jar.set(SESSION_COOKIE, crypto.randomUUID());
    expect(await canAccessCase({ ownerSessionHash: undefined })).toBe(false);
  });
});
