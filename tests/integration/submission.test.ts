import { beforeEach, describe, expect, it } from "vitest";
import { CaseService } from "@/lib/services/case-service";
import { createTestRepositories } from "./test-repositories";

const NOW = new Date("2026-09-27T15:00:00Z");
const applicant = {
  fullName: "Maria da Silva",
  email: "maria@example.com",
  phone: "11912345678",
  city: "Campinas",
  uf: "SP",
  consentAccepted: true,
};
const TRIAGE = [
  {
    produto_servico: "Plano de internet",
    fornecedor: "Operadora Exemplo",
    data_contratacao: "2026-05-10",
  },
  { pagamento_realizado: "total", valor_envolvido: "119,90" },
  { problema: "Cobrança em dobro na fatura", problema_continua: "sim", possui_comprovante: "sim" },
  { tentou_resolver: "nao" },
];
const NARRATIVE = "Em maio a operadora cobrou duas vezes a mesma fatura e não devolveu.";

let service: CaseService;
beforeEach(() => {
  service = new CaseService(createTestRepositories(), () => NOW);
});

async function readyCase() {
  const c = await service.createCase("consumidor");
  await service.saveApplicant(c.id, applicant);
  for (const [i, raw] of TRIAGE.entries()) await service.saveTriageStep(c.id, i, raw);
  await service.saveNarrative(c.id, { narrative: NARRATIVE });
  await service.addDocument(c.id, {
    category: "contrato",
    name: "contrato.pdf",
    size: 1000,
    mimeType: "application/pdf",
  });
  await service.finishDocuments(c.id);
  return c;
}

describe("envio do atendimento", () => {
  it("gera o dossiê, marca como finalizado e mantém o protocolo", async () => {
    const c = await readyCase();
    const r = await service.submitCase(c.id);
    expect(r.legalCase.status).toBe("submitted");
    expect(r.legalCase.submittedAt).toBe(NOW.toISOString());
    expect(r.dossier.version).toBe(1);
    expect(r.dossier.protocol).toBe(c.protocol);
    expect(r.dossier.narrative).toBe(NARRATIVE);
    expect(r.dossier.parties.map((p) => p.name)).toEqual(["Maria da Silva", "Operadora Exemplo"]);
    expect(r.dossier.documents).toEqual([
      { category: "Contrato ou termo de adesão", name: "contrato.pdf" },
    ]);
  });

  it("disponibiliza o envio para as telas de protocolo e dossiê", async () => {
    const c = await readyCase();
    expect(await service.getSubmission(c.id)).toBeNull();
    await service.submitCase(c.id);
    const s = await service.getSubmission(c.id);
    expect(s?.dossier.caseId).toBe(c.id);
    expect(s?.area.slug).toBe("consumidor");
  });

  it("não envia sem passar pela revisão", async () => {
    const c = await service.createCase("consumidor");
    await service.saveApplicant(c.id, applicant);
    for (const [i, raw] of TRIAGE.entries()) await service.saveTriageStep(c.id, i, raw);
    await service.saveNarrative(c.id, { narrative: NARRATIVE });
    await expect(service.submitCase(c.id)).rejects.toMatchObject({ code: "review_pending" });
  });

  it("bloqueia alterações depois de finalizado; repetir a finalização devolve a mesma", async () => {
    const c = await readyCase();
    const first = await service.submitCase(c.id);
    const again = await service.submitCase(c.id);
    expect(again.dossier.id).toBe(first.dossier.id);
    expect(again.legalCase.submittedAt).toBe(first.legalCase.submittedAt);
    await expect(
      service.saveNarrative(c.id, { narrative: `${NARRATIVE} Mais.` }),
    ).rejects.toMatchObject({
      code: "not_editable",
    });
    await expect(service.saveTriageStep(c.id, 0, TRIAGE[0])).rejects.toMatchObject({
      code: "not_editable",
    });
    await expect(
      service.addDocument(c.id, {
        category: "outros",
        name: "x.pdf",
        size: 10,
        mimeType: "application/pdf",
      }),
    ).rejects.toMatchObject({ code: "not_editable" });
  });

  it("dossiê emitido não muda se o caso mudar depois", async () => {
    const c = await readyCase();
    const { dossier } = await service.submitCase(c.id);
    const before = structuredClone(dossier);
    const again = await service.getSubmission(c.id);
    expect(again?.dossier).toEqual(before);
  });
});
