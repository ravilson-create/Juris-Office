import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const getSession = vi.fn(async (_args: unknown) => ({
  data: { user: { id: "user-neon", email: "user@example.com", emailVerified: true } },
}));
vi.mock("@/lib/auth/server", () => ({
  getAuth: () => ({ getSession }),
}));
vi.stubEnv("NEON_AUTH_BASE_URL", "https://auth.example.test");
vi.stubEnv("NEON_AUTH_COOKIE_SECRET", "a".repeat(64));
const { currentIdentity } = await import("@/lib/auth/session");

describe("Neon Auth: leitura da sessão em Server Components", () => {
  it("não solicita refresh de cookies durante a renderização", async () => {
    expect(await currentIdentity()).toEqual({
      id: "user-neon", email: "user@example.com", emailVerified: true,
    });
    expect(getSession).toHaveBeenCalledWith({ query: { disableRefresh: "true" } });
  });
});
