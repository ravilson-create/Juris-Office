import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkRateLimit } = await import("@/lib/rate-limit");

describe("checkRateLimit sem banco configurado", () => {
  it("nunca limita (memória/dev/testes em memória)", async () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit("teste:sem-banco", 1, 3600)).toBe(true);
    }
  });
});
