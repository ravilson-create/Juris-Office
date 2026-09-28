import { describe, expect, it } from "vitest";
import { generateProtocol } from "@/domain/case/protocol";
import {
  businessDate,
  formatCivilDate,
  formatInstantDate,
  formatInstantDateTime,
  isCivilDate,
} from "@/domain/time";
import { parseAnswer } from "@/domain/triage/engine";
import type { TriageQuestion } from "@/domain/triage/schema";

// São Paulo é UTC−3 (sem horário de verão desde 2019).
describe("dia de negócio perto da meia-noite", () => {
  it.each([
    ["2026-09-28T01:00:00Z", "2026-09-27"], // 22h do dia 27 em SP; já é 28 em UTC
    ["2026-09-28T02:59:59Z", "2026-09-27"], // 23:59:59 em SP
    ["2026-09-28T03:00:00Z", "2026-09-28"], // meia-noite em SP
    ["2026-09-27T23:59:59Z", "2026-09-27"], // perto da meia-noite UTC
    ["2026-09-28T00:00:00Z", "2026-09-27"], // meia-noite UTC = 21h em SP
    ["2026-12-31T23:30:00Z", "2026-12-31"], // virada de ano em UTC, não em SP
    ["2027-01-01T03:00:00Z", "2027-01-01"],
  ])("%s → %s", (iso, day) => {
    expect(businessDate(new Date(iso))).toBe(day);
    expect(formatInstantDate(iso)).toBe(formatCivilDate(day));
  });

  it("confirmação por extenso usa o mesmo dia", () => {
    expect(formatInstantDateTime("2026-09-28T01:00:00Z")).toMatch(/^27 de setembro de 2026.*22:00/);
  });

  it("protocolo usa o dia de criação no fuso de negócio", () => {
    const fixed = () => new Uint8Array(6);
    expect(generateProtocol(new Date("2026-09-28T01:00:00Z"), fixed)).toMatch(/^JO-20260927-/);
    expect(generateProtocol(new Date("2026-09-28T03:00:00Z"), fixed)).toMatch(/^JO-20260928-/);
  });
});

describe("datas civis não mudam de dia", () => {
  it("formatação é textual, sem conversão de fuso", () => {
    expect(formatCivilDate("2026-05-10")).toBe("10/05/2026");
    expect(formatCivilDate("2026-01-01")).toBe("01/01/2026");
  });

  it("valida datas existentes", () => {
    expect(isCivilDate("2024-02-29")).toBe(true);
    expect(isCivilDate("2026-02-29")).toBe(false);
    expect(isCivilDate("2026-13-01")).toBe(false);
    expect(isCivilDate("2026-5-1")).toBe(false);
  });

  it("'não pode ser futura' usa o hoje de São Paulo", () => {
    const q = {
      key: "d",
      label: "Data",
      type: "date",
      required: true,
      constraints: { notFuture: true },
    } as unknown as TriageQuestion;
    const late = new Date("2026-09-28T01:00:00Z"); // 27/09 22h em SP
    expect(parseAnswer(q, "2026-09-27", late).ok).toBe(true);
    expect(parseAnswer(q, "2026-09-28", late).ok).toBe(false);
    const earlyUtc = new Date("2026-09-28T03:00:00Z"); // 28/09 00h em SP
    expect(parseAnswer(q, "2026-09-28", earlyUtc).ok).toBe(true);
  });
});
