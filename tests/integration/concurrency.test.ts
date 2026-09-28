import { beforeEach, describe, expect, it } from "vitest";
import { MAX_DOCUMENTS_PER_CASE } from "@/domain/document/rules";
import type { Repositories } from "@/lib/repositories/types";
import { InProcessCaseLock } from "@/lib/services/case-lock";
import { CaseService } from "@/lib/services/case-service";
import { NARRATIVE, pdf, readyConsumidorCase } from "./fixtures";
import { createTestRepositories } from "./test-repositories";

const NOW = new Date("2026-09-27T15:00:00Z");
let repos: Repositories;
let service: CaseService;

beforeEach(() => {
  repos = createTestRepositories();
  service = new CaseService(repos, () => NOW, new InProcessCaseLock());
});

async function dossierCount(caseId: string) {
  // Conta versões gravadas: a mais recente precisa ser a única (versão 1).
  const latest = await repos.dossiers.findLatest(caseId);
  return latest ? latest.version : 0;
}

describe("3.1 finalização concorrente e idempotente", () => {
  it("duas finalizações simultâneas produzem um único dossiê", async () => {
    const c = await readyConsumidorCase(service);
    const [a, b] = await Promise.all([service.submitCase(c.id), service.submitCase(c.id)]);
    expect(a.dossier.id).toBe(b.dossier.id);
    expect(await dossierCount(c.id)).toBe(1);
  });

  it("dez finalizações simultâneas, de 'abas' com travas independentes, também", async () => {
    const c = await readyConsumidorCase(service);
    // Cada aba com sua própria trava: só a verificação atômica da persistência protege.
    const tabs = Array.from(
      { length: 10 },
      () => new CaseService(repos, () => NOW, new InProcessCaseLock()),
    );
    const results = await Promise.allSettled(tabs.map((t) => t.submitCase(c.id)));
    const ids = new Set(
      results.filter((r) => r.status === "fulfilled").map((r) => r.value.dossier.id),
    );
    expect(ids.size).toBe(1);
    expect(await dossierCount(c.id)).toBe(1);
    const final = await repos.cases.findById(c.id);
    expect(final?.status).toBe("submitted");
  });

  it("repetir depois de concluído devolve o mesmo resultado", async () => {
    const c = await readyConsumidorCase(service);
    const first = await service.submitCase(c.id);
    const again = await service.submitCase(c.id);
    expect(again.dossier).toEqual(first.dossier);
    expect(again.legalCase.submittedAt).toBe(first.legalCase.submittedAt);
  });

  it("falha na gravação não deixa caso finalizado sem dossiê; nova tentativa funciona", async () => {
    const c = await readyConsumidorCase(service);
    const original = repos.cases.finalizeSubmission.bind(repos.cases);
    repos.cases.finalizeSubmission = async () => {
      throw new Error("falha simulada de gravação");
    };
    await expect(service.submitCase(c.id)).rejects.toThrow("falha simulada");
    expect((await repos.cases.findById(c.id))?.status).toBe("ready_for_review");
    expect(await repos.dossiers.findLatest(c.id)).toBeNull();

    repos.cases.finalizeSubmission = original;
    const r = await service.submitCase(c.id);
    expect(r.legalCase.status).toBe("submitted");
    expect(r.dossier.version).toBe(1);
  });

  it("falha ao montar o dossiê não grava nada", async () => {
    const c = await readyConsumidorCase(service);
    const original = repos.documents.listByCase.bind(repos.documents);
    repos.documents.listByCase = async () => {
      throw new Error("falha simulada de leitura");
    };
    await expect(service.submitCase(c.id)).rejects.toThrow();
    repos.documents.listByCase = original;
    expect((await repos.cases.findById(c.id))?.submittedAt).toBeUndefined();
    expect(await repos.dossiers.findLatest(c.id)).toBeNull();
  });

  it("persistência recusa finalizar com revisão desatualizada", async () => {
    const c = await readyConsumidorCase(service);
    const stale = (await repos.cases.findById(c.id))!;
    await service.saveNarrative(c.id, { narrative: `${NARRATIVE} Alterado.` });
    // Dossiê válido de outro atendimento, reaproveitado só como carga útil.
    const other = await service.submitCase((await readyConsumidorCase(service)).id);
    const r = await repos.cases.finalizeSubmission({
      caseId: c.id,
      expectedRevision: stale.revision,
      dossier: { ...other.dossier, caseId: c.id, version: 1 },
      submittedAt: NOW.toISOString(),
    });
    expect(r).toEqual({ ok: false, reason: "revision_conflict" });
    expect(await repos.dossiers.findLatest(c.id)).toBeNull();
  });

  it("edição e finalização simultâneas: dossiê reflete exatamente o caso finalizado", async () => {
    for (let round = 0; round < 5; round++) {
      const c = await readyConsumidorCase(service);
      const edited = `${NARRATIVE} Rodada ${round}.`;
      const [edit, submit] = await Promise.allSettled([
        round % 2 ? service.saveNarrative(c.id, { narrative: edited }) : Promise.resolve(null),
        service.submitCase(c.id),
        round % 2 ? Promise.resolve(null) : service.saveNarrative(c.id, { narrative: edited }),
      ]);
      expect(submit.status).toBe("fulfilled");
      const final = (await repos.cases.findById(c.id))!;
      const dossier = (await repos.dossiers.findLatest(c.id))!;
      expect(dossier.narrative).toBe(final.narrative);
      expect(final.status).toBe("submitted");
      void edit;
    }
  });
});

describe("3.6 limite de documentos sob concorrência", () => {
  async function withDocs(n: number) {
    const c = await readyConsumidorCase(service);
    for (let i = 0; i < n; i++) await service.addDocument(c.id, pdf(`d${i}.pdf`));
    return c.id;
  }

  it("com 19 documentos, duas inclusões simultâneas: só uma é aceita", async () => {
    const id = await withDocs(MAX_DOCUMENTS_PER_CASE - 1);
    const results = await Promise.allSettled([
      service.addDocument(id, pdf("a.pdf")),
      service.addDocument(id, pdf("b.pdf")),
    ]);
    const accepted = results.filter((r) => r.status === "fulfilled" && r.value.ok);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "document_limit" });
    expect((await repos.documents.listByCase(id)).length).toBe(MAX_DOCUMENTS_PER_CASE);
  });

  it("nunca passa de 20, nem com travas independentes por aba", async () => {
    const id = await withDocs(15);
    const tabs = Array.from(
      { length: 12 },
      () => new CaseService(repos, () => NOW, new InProcessCaseLock()),
    );
    await Promise.allSettled(tabs.map((t, i) => t.addDocument(id, pdf(`t${i}.pdf`))));
    expect((await repos.documents.listByCase(id)).length).toBe(MAX_DOCUMENTS_PER_CASE);
  });

  it("remover um documento libera uma vaga", async () => {
    const id = await withDocs(MAX_DOCUMENTS_PER_CASE);
    await expect(service.addDocument(id, pdf("x.pdf"))).rejects.toMatchObject({
      code: "document_limit",
    });
    const [first] = await repos.documents.listByCase(id);
    expect((await service.removeDocument(id, first.id)).ok).toBe(true);
    expect((await service.addDocument(id, pdf("x.pdf"))).ok).toBe(true);
    await expect(service.addDocument(id, pdf("y.pdf"))).rejects.toMatchObject({
      code: "document_limit",
    });
  });

  it("inclusão simultânea à finalização: dossiê e caso ficam coerentes", async () => {
    for (let round = 0; round < 4; round++) {
      const id = await withDocs(2);
      const ops =
        round % 2
          ? [service.addDocument(id, pdf("tarde.pdf")), service.submitCase(id)]
          : [service.submitCase(id), service.addDocument(id, pdf("tarde.pdf"))];
      await Promise.allSettled(ops);
      const docs = (await repos.documents.listByCase(id)).map((d) => d.originalName).sort();
      const dossier = (await repos.dossiers.findLatest(id))!;
      expect(dossier.documents.map((d) => d.name).sort()).toEqual(docs);
    }
  });
});
