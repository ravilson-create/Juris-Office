import { describe, expect, it } from "vitest";
import { generateProtocol, isValidProtocol } from "@/domain/case/protocol";

describe("generateProtocol", () => {
  it("usa o formato JO-AAAAMMDD-28 caracteres aleatórios com a data UTC", () => {
    const p = generateProtocol(
      new Date("2026-09-27T23:30:00Z"),
      (size) => new Uint8Array(Array.from({ length: size }, (_, i) => i % 6)),
    );
    expect(p).toBe("JO-20260927-2345672345672345672345672345");
    expect(isValidProtocol(p)).toBe(true);
  });

  it("não usa caracteres ambíguos", () => {
    for (let i = 0; i < 200; i++) {
      const suffix = generateProtocol().split("-")[2];
      expect(suffix).not.toMatch(/[01ILO]/);
    }
  });

  it("gera valores distintos", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateProtocol()));
    expect(set.size).toBe(500);
  });
});
