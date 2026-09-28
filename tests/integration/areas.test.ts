import { describe, expect, it } from "vitest";
import { CaseService } from "@/lib/services/case-service";
import { createTestRepositories } from "./test-repositories";

const applicant = {
  fullName: "João de Teste",
  email: "joao@example.com",
  phone: "21987654321",
  city: "Niterói",
  uf: "RJ",
  consentAccepted: true,
};

async function start(slug: string) {
  const service = new CaseService(createTestRepositories(), () => new Date("2026-09-27T12:00:00Z"));
  const c = await service.createCase(slug);
  await service.saveApplicant(c.id, applicant);
  return { service, caseId: c.id };
}

describe("a triagem muda conforme a área", () => {
  it.each([
    ["consumidor", "O produto ou serviço"],
    ["trabalhista", "O vínculo de trabalho"],
    ["familia", "O assunto"],
    ["previdenciario", "O benefício"],
    ["civel", "O conflito"],
  ])("%s começa em “%s”", async (slug, firstStep) => {
    const { service, caseId } = await start(slug);
    const ctx = await service.getTriageContext(caseId);
    expect(ctx?.area.slug).toBe(slug);
    expect(ctx?.steps[0].title).toBe(firstStep);
    expect(ctx?.questions.every((q) => q.legalAreaId === ctx.area.id)).toBe(true);
  });
});

describe("cenário Trabalhista (verbas e jornada)", () => {
  it("usa resposta de etapa anterior para exibir perguntas de desligamento", async () => {
    const { service, caseId } = await start("trabalhista");
    await service.saveTriageStep(caseId, 0, {
      empregador: "Comércio Exemplo Ltda.",
      funcao: "Vendedor",
      data_inicio: "2022-02-01",
      ainda_trabalha: "nao",
      data_termino: "2026-07-31",
      registro_formal: "parcial",
    });
    await service.saveTriageStep(caseId, 1, {
      remuneracao: "2.300,00",
      controle_ponto: "sim",
      valores_nao_pagos: ["horas_extras", "fgts"],
    });

    const missing = await service.saveTriageStep(caseId, 2, { possui_comprovantes: "sim" });
    expect(!missing.ok && Object.keys(missing.fieldErrors ?? {})).toEqual([
      "forma_desligamento",
      "documentos_rescisorios",
    ]);

    const done = await service.saveTriageStep(caseId, 2, {
      forma_desligamento: "sem_justa_causa",
      documentos_rescisorios: "nao",
      possui_comprovantes: "sim",
    });
    expect(done.ok && done.data.nextStep).toBeNull();
    expect((await service.getTriageContext(caseId))?.completion).toBe(100);
  });

  it("dispensa perguntas de desligamento para quem ainda trabalha", async () => {
    const { service, caseId } = await start("trabalhista");
    await service.saveTriageStep(caseId, 0, {
      empregador: "Empresa",
      funcao: "Auxiliar",
      data_inicio: "2024-01-10",
      ainda_trabalha: "sim",
      registro_formal: "sim",
    });
    await service.saveTriageStep(caseId, 1, { controle_ponto: "nao" });
    const r = await service.saveTriageStep(caseId, 2, { possui_comprovantes: "nao" });
    expect(r.ok).toBe(true);
  });
});

describe("cenário Família (organização documental)", () => {
  it("exige quantidade de filhos só quando há filhos menores", async () => {
    const { service, caseId } = await start("familia");
    const base = { assunto: "pensao", pessoas_envolvidas: "Eu e o pai da minha filha." };
    const r1 = await service.saveTriageStep(caseId, 0, { ...base, filhos_menores: "sim" });
    expect(!r1.ok && r1.fieldErrors).toEqual({
      quantidade_filhos: "Responda esta pergunta para continuar.",
    });
    const r2 = await service.saveTriageStep(caseId, 0, {
      ...base,
      filhos_menores: "sim",
      quantidade_filhos: "1",
    });
    expect(r2.ok).toBe(true);
    expect((await service.getTriageContext(caseId))?.answers.quantidade_filhos).toBe(1);
  });
});
