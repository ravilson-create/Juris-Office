import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  InvalidStatusTransitionError,
  isDeletable,
  isEditableByCitizen,
} from "@/domain/case/status";

describe("transições de status", () => {
  it("permite o caminho feliz do cidadão até o envio", () => {
    expect(canTransition("draft", "triage")).toBe(true);
    expect(canTransition("triage", "ready_for_review")).toBe(true);
    expect(canTransition("ready_for_review", "submitted")).toBe(true);
  });

  it("impede pular etapas", () => {
    expect(canTransition("draft", "submitted")).toBe(false);
    expect(() => assertTransition("draft", "active")).toThrow(InvalidStatusTransitionError);
  });

  it("caso encerrado não muda mais", () => {
    expect(canTransition("closed", "active")).toBe(false);
  });

  it("cidadão só edita antes do envio ou quando pedem informação", () => {
    expect(isEditableByCitizen("triage")).toBe(true);
    expect(isEditableByCitizen("needs_information")).toBe(true);
    expect(isEditableByCitizen("submitted")).toBe(false);
  });

  it("atendimento só é excluível antes de aceito/em andamento", () => {
    expect(isDeletable("draft")).toBe(true);
    expect(isDeletable("submitted")).toBe(true);
    expect(isDeletable("under_legal_review")).toBe(true);
    expect(isDeletable("needs_information")).toBe(true);
    expect(isDeletable("rejected")).toBe(true);
    expect(isDeletable("accepted")).toBe(false);
    expect(isDeletable("in_negotiation")).toBe(false);
    expect(isDeletable("active")).toBe(false);
    expect(isDeletable("closed")).toBe(false);
  });
});
