import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { hasDatabase } = await import("@/lib/db/connection");

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("hasDatabase", () => {
  it("falso sem nenhuma das duas variáveis", () => {
    delete process.env.DATABASE_URL;
    delete process.env.APP_DATABASE_URL;
    expect(hasDatabase()).toBe(false);
  });

  it("verdadeiro só com DATABASE_URL (sem papel restrito configurado)", () => {
    delete process.env.APP_DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://dono@exemplo/db";
    expect(hasDatabase()).toBe(true);
  });

  it("verdadeiro com APP_DATABASE_URL, mesmo sem DATABASE_URL", () => {
    delete process.env.DATABASE_URL;
    process.env.APP_DATABASE_URL = "postgresql://juris_app@exemplo/db";
    expect(hasDatabase()).toBe(true);
  });
});
