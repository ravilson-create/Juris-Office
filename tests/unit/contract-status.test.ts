import { describe, expect, it } from "vitest";
import {
  assertContractTransition,
  canTransitionContract,
  InvalidContractTransitionError,
} from "@/domain/contract/status";
import { statusCasoParaDecisao } from "@/domain/contract/schema";

describe("transições de status do contrato", () => {
  it("permite draft → sent → cancelled", () => {
    expect(canTransitionContract("draft", "sent")).toBe(true);
    expect(canTransitionContract("sent", "cancelled")).toBe(true);
  });

  it("permite draft → cancelled direto, sem passar por sent", () => {
    expect(canTransitionContract("draft", "cancelled")).toBe(true);
  });

  it("'signed' ainda não é alcançável por nenhuma transição (fica para a PR5)", () => {
    expect(canTransitionContract("draft", "signed")).toBe(false);
    expect(canTransitionContract("sent", "signed")).toBe(false);
    expect(() => assertContractTransition("draft", "signed")).toThrow(
      InvalidContractTransitionError,
    );
  });

  it("contrato cancelado ou assinado não muda mais", () => {
    expect(canTransitionContract("cancelled", "draft")).toBe(false);
    expect(canTransitionContract("signed", "cancelled")).toBe(false);
  });

  it("nunca volta de sent para draft", () => {
    expect(canTransitionContract("sent", "draft")).toBe(false);
  });
});

describe("statusCasoParaDecisao", () => {
  it("mapeia cada decisão de viabilidade para o status de caso correspondente", () => {
    expect(statusCasoParaDecisao("accepted")).toBe("accepted");
    expect(statusCasoParaDecisao("rejected")).toBe("rejected");
    expect(statusCasoParaDecisao("needs_info")).toBe("needs_information");
  });
});
