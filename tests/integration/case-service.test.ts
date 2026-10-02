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

describe("exclusão de atendimento", () => {
  it("exclui um atendimento ainda não aceito", async () => {
    const repos = createTestRepositories();
    const svc = new CaseService(repos, () => NOW);
    const c = await svc.createCase("consumidor");
    const result = await svc.deleteCase(c.id);
    expect(result).toEqual({ ok: true, data: null });
    expect(await svc.getOverview(c.id)).toBeNull();
  });

  it("recusa excluir um atendimento já aceito/em andamento", async () => {
    const repos = createTestRepositories();
    const svc = new CaseService(repos, () => NOW);
    const c = await svc.createCase("consumidor");
    await repos.cases.update(c.id, { status: "active" });
    const result = await svc.deleteCase(c.id);
    expect(result.ok).toBe(false);
    expect(await svc.getOverview(c.id)).not.toBeNull();
  });

  it("devolve falha para um id inexistente", async () => {
    const svc = new CaseService(createTestRepositories(), () => NOW);
    const result = await svc.deleteCase("00000000-0000-4000-8000-000000000099");
    expect(result.ok).toBe(false);
  });
});

describe("arquivar/desarquivar atendimento", () => {
  it("arquiva e desarquiva em qualquer status, sem apagar nada", async () => {
    const repos = createTestRepositories();
    const svc = new CaseService(repos, () => NOW);
    const c = await svc.createCase("consumidor");
    await repos.cases.update(c.id, { status: "active" });

    const arquivado = await svc.archiveCase(c.id);
    expect(arquivado).toEqual({ ok: true, data: null });
    const overviewArquivado = await svc.getOverview(c.id);
    expect(overviewArquivado?.legalCase.archivedAt).toBeTruthy();
    expect(overviewArquivado?.legalCase.status).toBe("active");

    const desarquivado = await svc.unarchiveCase(c.id);
    expect(desarquivado).toEqual({ ok: true, data: null });
    const overviewDesarquivado = await svc.getOverview(c.id);
    expect(overviewDesarquivado?.legalCase.archivedAt).toBeFalsy();
  });

  it("devolve falha para um id inexistente", async () => {
    const svc = new CaseService(createTestRepositories(), () => NOW);
    expect((await svc.archiveCase("00000000-0000-4000-8000-000000000099")).ok).toBe(false);
    expect((await svc.unarchiveCase("00000000-0000-4000-8000-000000000099")).ok).toBe(false);
  });

  it("listMyCases sinaliza quais estão arquivados, sem ocultá-los", async () => {
    const hash = "b".repeat(64);
    const svc = new CaseService(createTestRepositories(), () => NOW);
    const ativo = await svc.createCase("consumidor", hash);
    const arquivado = await svc.createCase("consumidor", hash);
    await svc.archiveCase(arquivado.id);

    const items = await svc.listMyCases(hash);
    const porId = new Map(items.map((i) => [i.id, i]));
    expect(porId.get(ativo.id)?.archived).toBe(false);
    expect(porId.get(arquivado.id)?.archived).toBe(true);
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
