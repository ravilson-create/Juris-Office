import { beforeEach, describe, expect, it } from "vitest";
import { InProcessCaseLock } from "@/lib/services/case-lock";
import { CaseService } from "@/lib/services/case-service";
import { APPLICANT, CONSUMIDOR_TRIAGE, readyConsumidorCase } from "./fixtures";
import { createTestRepositories } from "./test-repositories";

let clock: Date;
let service: CaseService;
const tick = (ms: number) => (clock = new Date(clock.getTime() + ms));
const meta = (formKey: string, seq: number, baseTime: Date) => ({
  formKey,
  seq,
  baseTime: baseTime.toISOString(),
});
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  clock = new Date("2026-09-27T15:00:00Z");
  service = new CaseService(createTestRepositories(), () => clock, new InProcessCaseLock());
});

async function caseInTriage() {
  const c = await service.createCase("consumidor");
  await service.saveApplicant(c.id, APPLICANT);
  return c.id;
}

describe("rascunhos", () => {
  it("rascunho incompleto é aceito e não conclui a etapa", async () => {
    const id = await caseInTriage();
    const loaded = new Date(clock);
    tick(1000);
    const r = await service.saveDraft(
      id,
      "triagem:0",
      { produto_servico: "Plano" },
      meta(A, 1, loaded),
    );
    expect(r).toMatchObject({ ok: true, data: { status: "saved" } });
    const ctx = (await service.getTriageContext(id))!;
    expect(ctx.answers.produto_servico).toBeUndefined();
    expect(ctx.completion).toBe(0);
    expect((await service.getDraft(id, "triagem:0"))?.values).toEqual({ produto_servico: "Plano" });
  });

  it("resposta fora de ordem (sequência menor) não sobrescreve a mais recente", async () => {
    const id = await caseInTriage();
    const loaded = new Date(clock);
    await service.saveDraft(id, "relato", { narrative: "versão 2" }, meta(A, 2, loaded));
    const late = await service.saveDraft(
      id,
      "relato",
      { narrative: "versão 1" },
      meta(A, 1, loaded),
    );
    expect(late).toMatchObject({ ok: true, data: { status: "stale" } });
    expect((await service.getDraft(id, "relato"))?.values.narrative).toBe("versão 2");
  });

  it("rascunho atrasado não sobrescreve a parte já salva oficialmente", async () => {
    const id = await caseInTriage();
    const loaded = new Date(clock);
    await service.saveDraft(id, "triagem:0", { produto_servico: "rascunho" }, meta(A, 1, loaded));
    tick(5000);
    const saved = await service.saveTriageStep(id, 0, CONSUMIDOR_TRIAGE[0]);
    expect(saved.ok).toBe(true);
    expect(await service.getDraft(id, "triagem:0")).toBeNull();
    // Chega depois, vindo da página carregada antes da gravação oficial.
    tick(1000);
    const late = await service.saveDraft(
      id,
      "triagem:0",
      { produto_servico: "atrasado" },
      meta(A, 2, loaded),
    );
    expect(late).toMatchObject({ ok: true, data: { status: "stale" } });
    expect(await service.getDraft(id, "triagem:0")).toBeNull();
    // Página recarregada depois da gravação pode voltar a salvar rascunho.
    const fresh = await service.saveDraft(
      id,
      "triagem:0",
      { produto_servico: "novo" },
      meta(B, 1, clock),
    );
    expect(fresh).toMatchObject({ ok: true, data: { status: "saved" } });
  });

  it("outra aba carregada depois vence; a carregada antes não sobrescreve", async () => {
    const id = await caseInTriage();
    const old = new Date(clock);
    tick(60_000);
    const recent = new Date(clock);
    await service.saveDraft(id, "relato", { narrative: "aba nova" }, meta(B, 1, recent));
    const r = await service.saveDraft(id, "relato", { narrative: "aba antiga" }, meta(A, 9, old));
    expect(r).toMatchObject({ data: { status: "stale" } });
    expect((await service.getDraft(id, "relato"))?.values.narrative).toBe("aba nova");
  });

  it("rascunhos ficam isolados por atendimento", async () => {
    const a = await caseInTriage();
    const b = await caseInTriage();
    await service.saveDraft(a, "relato", { narrative: "do A" }, meta(A, 1, clock));
    expect(await service.getDraft(b, "relato")).toBeNull();
  });

  it("recusa rascunho em caso finalizado e apaga os existentes ao finalizar", async () => {
    const c = await readyConsumidorCase(service);
    await service.saveDraft(c.id, "relato", { narrative: "sobra" }, meta(A, 1, clock));
    await service.submitCase(c.id);
    expect(await service.getDraft(c.id, "relato")).toBeNull();
    await expect(
      service.saveDraft(c.id, "relato", { narrative: "tarde" }, meta(A, 2, clock)),
    ).rejects.toMatchObject({ code: "not_editable" });
  });

  it.each([
    ["escopo inválido", "outra-coisa", { narrative: "x" }, meta(A, 1, new Date())],
    ["valores grandes demais", "relato", { narrative: "x".repeat(10_001) }, meta(A, 1, new Date())],
    ["metadados ausentes", "relato", { narrative: "x" }, {}],
  ])("recusa %s", async (_label, scope, values, m) => {
    const id = await caseInTriage();
    const r = await service.saveDraft(id, scope, values, m);
    expect(r.ok).toBe(false);
  });
});
