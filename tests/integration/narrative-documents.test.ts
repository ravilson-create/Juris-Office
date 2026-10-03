import { beforeEach, describe, expect, it } from "vitest";
import { MAX_DOCUMENTS_PER_CASE } from "@/domain/document/rules";
import { CaseService } from "@/lib/services/case-service";
import { createTestRepositories } from "./test-repositories";

const NOW = new Date("2026-09-27T12:00:00Z");
const applicant = {
  fullName: "Maria da Silva",
  cpf: "11144477735",
  email: "maria@example.com",
  phone: "11912345678",
  city: "Campinas",
  uf: "SP",
  consentAccepted: true,
};
const TRIAGE = [
  { produto_servico: "Plano de internet", fornecedor: "Operadora Exemplo" },
  { pagamento_realizado: "total", valor_envolvido: "119,90" },
  { problema: "Cobrança em dobro na fatura", problema_continua: "sim", possui_comprovante: "sim" },
  { tentou_resolver: "nao" },
];
const NARRATIVE = "Em maio a operadora cobrou duas vezes a mesma fatura e não devolveu.";
const pdf = (category: string, name = "arquivo.pdf") => ({
  category,
  name,
  size: 50_000,
  mimeType: "application/pdf",
});

let service: CaseService;
beforeEach(() => {
  service = new CaseService(createTestRepositories(), () => NOW);
});

async function caseWithTriage() {
  const c = await service.createCase("consumidor");
  await service.saveApplicant(c.id, applicant);
  for (const [i, raw] of TRIAGE.entries()) {
    const r = await service.saveTriageStep(c.id, i, raw);
    expect(r.ok).toBe(true);
  }
  return c.id;
}

async function caseWithNarrative() {
  const id = await caseWithTriage();
  const r = await service.saveNarrative(id, { narrative: NARRATIVE });
  expect(r.ok).toBe(true);
  return id;
}

describe("relato", () => {
  it("exige triagem concluída", async () => {
    const c = await service.createCase("consumidor");
    await service.saveApplicant(c.id, applicant);
    await service.saveTriageStep(c.id, 0, TRIAGE[0]);
    await expect(service.saveNarrative(c.id, { narrative: NARRATIVE })).rejects.toMatchObject({
      code: "triage_pending",
    });
  });

  it("salva o relato e avança para documentos", async () => {
    const id = await caseWithTriage();
    const r = await service.saveNarrative(id, { narrative: `  ${NARRATIVE}  ` });
    expect(r.ok && r.data.narrative).toBe(NARRATIVE);
    expect(r.ok && r.data.status).toBe("awaiting_documents");
  });

  it("devolve erro de campo sem salvar quando o relato é curto", async () => {
    const id = await caseWithTriage();
    const r = await service.saveNarrative(id, { narrative: "curto" });
    expect(!r.ok && r.fieldErrors?.narrative).toMatch(/mínimo/);
    expect((await service.getOverview(id))?.legalCase.narrative).toBeUndefined();
  });

  it("editar depois da revisão mantém o status", async () => {
    const id = await caseWithNarrative();
    await service.finishDocuments(id);
    const r = await service.saveNarrative(id, { narrative: `${NARRATIVE} Tenho os protocolos.` });
    expect(r.ok && r.data.status).toBe("ready_for_review");
  });
});

describe("documentos (upload simulado)", () => {
  it("exige relato antes", async () => {
    const id = await caseWithTriage();
    await expect(service.addDocument(id, pdf("contrato"))).rejects.toMatchObject({
      code: "narrative_pending",
    });
  });

  it("adiciona, lista e remove", async () => {
    const id = await caseWithNarrative();
    const r = await service.addDocument(id, pdf("nota_fiscal", "C:\\temp\\nota.pdf"));
    expect(r.ok && r.data.originalName).toBe("nota.pdf");
    expect(r.ok && r.data.status).toBe("uploaded");
    let ctx = await service.getDocumentsContext(id);
    expect(ctx?.documents).toHaveLength(1);
    expect(ctx?.checklist.map((i) => i.category)).toContain("nota_fiscal");

    const removed = await service.removeDocument(id, r.ok ? r.data.id : "");
    expect(removed.ok).toBe(true);
    ctx = await service.getDocumentsContext(id);
    expect(ctx?.documents).toHaveLength(0);
  });

  it("aceita a categoria 'outros' e recusa categoria de outra área", async () => {
    const id = await caseWithNarrative();
    expect((await service.addDocument(id, pdf("outros"))).ok).toBe(true);
    const r = await service.addDocument(id, pdf("ctps"));
    expect(!r.ok && r.message).toMatch(/Categoria/);
  });

  it("recusa tipo não permitido", async () => {
    const id = await caseWithNarrative();
    const r = await service.addDocument(id, {
      ...pdf("contrato"),
      name: "script.exe",
      mimeType: "",
    });
    expect(!r.ok && r.message).toMatch(/não aceito/);
  });

  it(`limita a ${MAX_DOCUMENTS_PER_CASE} arquivos por atendimento`, async () => {
    const id = await caseWithNarrative();
    for (let i = 0; i < MAX_DOCUMENTS_PER_CASE; i++)
      await service.addDocument(id, pdf("outros", `d${i}.pdf`));
    await expect(service.addDocument(id, pdf("outros"))).rejects.toMatchObject({
      code: "document_limit",
    });
  });

  it("não remove documento de outro atendimento", async () => {
    const a = await caseWithNarrative();
    const b = await caseWithNarrative();
    const r = await service.addDocument(a, pdf("contrato"));
    const removed = await service.removeDocument(b, r.ok ? r.data.id : "");
    expect(removed.ok).toBe(false);
    expect((await service.getDocumentsContext(a))?.documents).toHaveLength(1);
  });
});

describe("revisão", () => {
  it("concluir documentos libera a revisão, mesmo sem arquivos", async () => {
    const id = await caseWithNarrative();
    const c = await service.finishDocuments(id);
    expect(c.status).toBe("ready_for_review");
  });

  it("reúne triagem, relato, documentos e recomendados pendentes", async () => {
    const id = await caseWithNarrative();
    await service.addDocument(id, pdf("contrato"));
    await service.finishDocuments(id);
    const ctx = await service.getReviewContext(id);
    expect(ctx?.legalCase.narrative).toBe(NARRATIVE);
    expect(ctx?.answers.produto_servico).toBe("Plano de internet");
    expect(ctx?.documents.map((d) => d.category)).toEqual(["contrato"]);
    expect(ctx?.missingRecommended.map((i) => i.category)).toEqual(["nota_fiscal", "comprovantes"]);
  });
});
