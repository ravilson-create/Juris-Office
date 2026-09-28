import { beforeEach, describe, expect, it } from "vitest";
import { isValidProtocol } from "@/domain/case/protocol";
import { CaseService } from "@/lib/services/case-service";
import { DomainError } from "@/lib/services/errors";
import { createTestRepositories } from "./test-repositories";

const NOW = new Date("2026-09-27T12:00:00Z");
const applicant = {
  fullName: "Maria da Silva",
  email: "maria@example.com",
  phone: "11912345678",
  city: "Campinas",
  uf: "SP",
  consentAccepted: true,
};

let service: CaseService;
beforeEach(() => {
  service = new CaseService(createTestRepositories(), () => NOW);
});

describe("criação do caso", () => {
  it("cria caso em rascunho com protocolo temporário", async () => {
    const c = await service.createCase("consumidor");
    expect(c.status).toBe("draft");
    expect(isValidProtocol(c.protocol)).toBe(true);
    expect(c.protocol.startsWith("JO-20260927-")).toBe(true);
  });

  it("recusa área inexistente", async () => {
    await expect(service.createCase("tributario")).rejects.toBeInstanceOf(DomainError);
  });

  it("lista as cinco áreas em ordem", async () => {
    const areas = await service.listLegalAreas();
    expect(areas.map((a) => a.slug)).toEqual([
      "consumidor",
      "trabalhista",
      "familia",
      "previdenciario",
      "civel",
    ]);
  });
});

describe("identificação", () => {
  it("salva o interessado e move o caso para triagem", async () => {
    const c = await service.createCase("consumidor");
    const r = await service.saveApplicant(c.id, applicant);
    expect(r.ok && r.data.status).toBe("triage");
    expect(r.ok && r.data.consentAcceptedAt).toBe(NOW.toISOString());
  });

  it("retorna erros por campo", async () => {
    const c = await service.createCase("consumidor");
    const r = await service.saveApplicant(c.id, {
      ...applicant,
      email: "x",
      consentAccepted: false,
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.fieldErrors ?? {})).toEqual(["email", "consentAccepted"]);
  });
});

describe("triagem de Consumidor", () => {
  it("bloqueia triagem sem identificação", async () => {
    const c = await service.createCase("consumidor");
    await expect(service.saveTriageStep(c.id, 0, {})).rejects.toMatchObject({
      code: "identification_pending",
    });
  });

  it("percorre as etapas, preserva respostas e permite corrigir", async () => {
    const c = await service.createCase("consumidor");
    await service.saveApplicant(c.id, applicant);

    const inputs = [
      { produto_servico: "Plano de internet", fornecedor: "Operadora Exemplo" },
      { pagamento_realizado: "total", valor_envolvido: "119,90" },
      {
        problema: "Cobrança em dobro na fatura",
        problema_continua: "sim",
        possui_comprovante: "sim",
      },
      { tentou_resolver: "sim", numero_protocolo: "2026000123", houve_resposta: "nao_resolveu" },
    ];
    const next: Array<number | null> = [];
    for (const [i, raw] of inputs.entries()) {
      const r = await service.saveTriageStep(c.id, i, raw);
      expect(r.ok).toBe(true);
      if (r.ok) next.push(r.data.nextStep);
    }
    expect(next).toEqual([1, 2, 3, null]);

    let ctx = await service.getTriageContext(c.id);
    expect(ctx?.completion).toBe(100);
    expect(ctx?.answers.valor_envolvido).toBe(119.9);

    // Usuário volta e muda a resposta: perguntas condicionais somem.
    await service.saveTriageStep(c.id, 3, { tentou_resolver: "nao" });
    ctx = await service.getTriageContext(c.id);
    expect(ctx?.answers.tentou_resolver).toBe(false);
    expect(ctx?.answers.numero_protocolo).toBeUndefined();
    expect(ctx?.answers.houve_resposta).toBeUndefined();

    // Campo opcional apagado é removido.
    await service.saveTriageStep(c.id, 1, { pagamento_realizado: "total", valor_envolvido: "" });
    ctx = await service.getTriageContext(c.id);
    expect(ctx?.answers.valor_envolvido).toBeUndefined();
  });

  it("não salva nada quando a etapa é inválida", async () => {
    const c = await service.createCase("consumidor");
    await service.saveApplicant(c.id, applicant);
    const r = await service.saveTriageStep(c.id, 0, { produto_servico: "Celular" });
    expect(r.ok).toBe(false);
    const ctx = await service.getTriageContext(c.id);
    expect(ctx?.answers).toEqual({});
  });
});

describe("dono do atendimento", () => {
  it("guarda o hash da sessão informado na criação", async () => {
    const service = new CaseService(
      createTestRepositories(),
      () => new Date("2026-09-27T12:00:00Z"),
    );
    const hash = "a".repeat(64);
    const c = await service.createCase("consumidor", hash);
    expect(c.ownerSessionHash).toBe(hash);
    expect((await service.getOverview(c.id))?.legalCase.ownerSessionHash).toBe(hash);
  });
});
