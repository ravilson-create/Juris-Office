import { describe, expect, it } from "vitest";
import { formatInstantDate, formatInstantDateTime } from "@/domain/time";
import { InProcessCaseLock } from "@/lib/services/case-lock";
import { CaseService } from "@/lib/services/case-service";
import { APPLICANT, readyConsumidorCase } from "./fixtures";
import { createTestRepositories } from "./test-repositories";

const make = (now = new Date("2026-09-27T15:00:00Z")) =>
  new CaseService(createTestRepositories(), () => now, new InProcessCaseLock());

const VINCULO = {
  empregador: "Empresa",
  funcao: "Auxiliar",
  data_inicio: "2020-03-01",
  registro_formal: "sim",
};

describe("3.5 respostas condicionais entre etapas", () => {
  it("respostas de desligamento não voltam depois de 'ainda trabalha' → 'não trabalha'", async () => {
    const s = make();
    const c = await s.createCase("trabalhista");
    await s.saveApplicant(c.id, APPLICANT);
    await s.saveTriageStep(c.id, 0, {
      ...VINCULO,
      ainda_trabalha: "nao",
      data_termino: "2024-01-10",
    });
    await s.saveTriageStep(c.id, 1, { controle_ponto: "sim" });
    await s.saveTriageStep(c.id, 2, {
      forma_desligamento: "pedido",
      documentos_rescisorios: "sim",
      possui_comprovantes: "sim",
    });
    expect((await s.getTriageContext(c.id))!.completion).toBe(100);

    await s.saveTriageStep(c.id, 0, { ...VINCULO, ainda_trabalha: "sim" });
    let ctx = (await s.getTriageContext(c.id))!;
    expect(ctx.answers.data_termino).toBeUndefined();
    expect(ctx.answers.forma_desligamento).toBeUndefined();
    expect(ctx.answers.documentos_rescisorios).toBeUndefined();
    expect(ctx.answers.possui_comprovantes).toBe(true); // não dependia da condição

    await s.saveTriageStep(c.id, 0, {
      ...VINCULO,
      ainda_trabalha: "nao",
      data_termino: "2024-01-10",
    });
    ctx = (await s.getTriageContext(c.id))!;
    expect(ctx.answers.forma_desligamento).toBeUndefined();
    expect(ctx.completion).toBeLessThan(100);
    expect(await s.isTriageComplete(ctx.legalCase)).toBe(false);

    // A pergunta reaberta exige nova resposta.
    const r = await s.saveTriageStep(c.id, 2, { possui_comprovantes: "sim" });
    expect(!r.ok && Object.keys(r.fieldErrors ?? {}).sort()).toEqual([
      "documentos_rescisorios",
      "forma_desligamento",
    ]);
  });

  it("finalização recusa resposta gravada que não passa mais nas regras", async () => {
    const repos = createTestRepositories();
    const s = new CaseService(
      repos,
      () => new Date("2026-09-27T15:00:00Z"),
      new InProcessCaseLock(),
    );
    const c = await readyConsumidorCase(s);
    // Dado antigo/corrompido gravado direto na persistência: data futura.
    const [question] = (await repos.triage.listQuestions(c.legalAreaId)).filter(
      (q) => q.key === "data_contratacao",
    );
    await repos.triage.saveAnswer({ caseId: c.id, question, value: "2030-01-01" });
    const ctx = (await s.getTriageContext(c.id))!;
    expect(Object.keys(ctx.invalid)).toEqual(["data_contratacao"]);
    expect(ctx.validAnswers.data_contratacao).toBeUndefined();
    await expect(s.submitCase(c.id)).rejects.toMatchObject({ code: "triage_pending" });
    expect(await repos.dossiers.findLatest(c.id)).toBeNull();
  });
});

describe("3.4 datas do vínculo", () => {
  it("não salva término anterior ao início; aceita datas iguais", async () => {
    const s = make();
    const c = await s.createCase("trabalhista");
    await s.saveApplicant(c.id, APPLICANT);
    const bad = await s.saveTriageStep(c.id, 0, {
      ...VINCULO,
      data_inicio: "2025-03-01",
      ainda_trabalha: "nao",
      data_termino: "2020-01-10",
    });
    expect(!bad.ok && bad.fieldErrors?.data_termino).toMatch(/anterior/);
    expect((await s.getTriageContext(c.id))!.answers.data_termino).toBeUndefined();
    const same = await s.saveTriageStep(c.id, 0, {
      ...VINCULO,
      data_inicio: "2025-03-01",
      ainda_trabalha: "nao",
      data_termino: "2025-03-01",
    });
    expect(same.ok).toBe(true);
  });
});

describe("3.7 mesmo dia em todas as telas", () => {
  it.each([
    ["22h de 27/09 em SP (já 28 em UTC)", "2026-09-28T01:00:00Z", "27/09/2026", "JO-20260927-"],
    ["00h30 de 28/09 em SP", "2026-09-28T03:30:00Z", "28/09/2026", "JO-20260928-"],
    ["pouco antes da meia-noite UTC", "2026-09-27T23:59:00Z", "27/09/2026", "JO-20260927-"],
  ])("%s", async (_label, iso, day, protocolPrefix) => {
    const s = make(new Date(iso));
    const c = await readyConsumidorCase(s);
    const r = await s.submitCase(c.id);
    const lastEvent = r.dossier.chronology.at(-1)!;
    const [y, m, d] = lastEvent.date!.split("-");
    expect(`${d}/${m}/${y}`).toBe(day); // linha do tempo do dossiê
    expect(formatInstantDate(r.dossier.createdAt)).toBe(day); // cabeçalho do dossiê/impressão
    expect(formatInstantDateTime(r.legalCase.submittedAt!)).toMatch(
      new RegExp(`^${Number(d)} de setembro de 2026`),
    ); // confirmação por extenso
    expect(r.legalCase.protocol.startsWith(protocolPrefix)).toBe(true);
    // Data dos fatos (civil) não muda de dia.
    expect(r.dossier.chronology[0]).toEqual({
      date: "2026-05-10",
      description: "Compra ou contratação",
    });
    expect(r.legalCase.submittedAt).toBe(new Date(iso).toISOString()); // instante em UTC
  });
});
