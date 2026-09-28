import { describe, expect, it } from "vitest";
import type { Applicant, LegalCase } from "@/domain/case/schema";
import type { CaseDocument } from "@/domain/document/schema";
import { OTHER_DOCUMENTS_LABEL } from "@/domain/document/schema";
import { buildDossier, FACTS_SUMMARY_MAX, summarize } from "@/domain/dossier/builder";
import { DOSSIER_DISCLAIMER, dossierSchema } from "@/domain/dossier/schema";
import { DOCUMENT_CHECKLISTS } from "@/lib/mocks/document-checklists";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { ALL_TRIAGE_QUESTIONS } from "@/lib/mocks/triage";

const NOW = new Date("2026-09-27T15:00:00Z");
const area = (slug: string) => LEGAL_AREAS.find((a) => a.slug === slug)!;
const applicant: Applicant = {
  fullName: "Maria da Silva",
  email: "maria@example.com",
  phone: "11912345678",
  city: "Campinas",
  uf: "SP",
  consentAccepted: true,
};

function input(slug: string, answers: Record<string, unknown>, documents: CaseDocument[] = []) {
  const a = area(slug);
  const legalCase = {
    id: "11111111-1111-4111-8111-111111111111",
    protocol: "JO-20260927-ABCDEF",
    legalAreaId: a.id,
    status: "ready_for_review",
    consentAccepted: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    applicant,
    narrative: "A operadora cobrou duas vezes a fatura de maio e não devolveu o valor.",
  } as LegalCase & { applicant: Applicant; narrative: string };
  return {
    id: "22222222-2222-4222-8222-222222222222",
    version: 1,
    legalCase,
    area: a,
    questions: ALL_TRIAGE_QUESTIONS.filter((q) => q.legalAreaId === a.id),
    answers: answers as never,
    documents,
    checklist: DOCUMENT_CHECKLISTS.filter((i) => i.legalAreaId === a.id),
    otherDocumentsLabel: OTHER_DOCUMENTS_LABEL,
    now: NOW,
  };
}

const consumidor = {
  produto_servico: "Plano de internet",
  fornecedor: "Operadora Exemplo",
  data_contratacao: "2026-05-10",
  valor_envolvido: 119.9,
  pagamento_realizado: "total",
  problema: "Cobrança em dobro",
  problema_continua: true,
  possui_comprovante: true,
  tentou_resolver: true,
  numero_protocolo: "2026000123",
  houve_resposta: "nao_resolveu",
};

const doc = (category: string, name: string): CaseDocument => ({
  id: crypto.randomUUID(),
  caseId: "11111111-1111-4111-8111-111111111111",
  category,
  originalName: name,
  status: "uploaded",
  createdAt: NOW.toISOString(),
});

describe("buildDossier — Consumidor", () => {
  const d = buildDossier(
    input("consumidor", consumidor, [doc("nota_fiscal", "nf.pdf"), doc("outros", "print.png")]),
  );

  it("é válido no schema e traz protocolo, área e aviso", () => {
    expect(dossierSchema.safeParse(d).success).toBe(true);
    expect(d.protocol).toBe("JO-20260927-ABCDEF");
    expect(d.areaName).toBe("Consumidor");
    expect(d.disclaimer).toBe(DOSSIER_DISCLAIMER);
  });

  it("preserva o relato original sem alteração", () => {
    expect(d.narrative).toBe(input("consumidor", {}).legalCase.narrative);
  });

  it("identifica partes, datas, valores e providências a partir das marcações", () => {
    expect(d.parties).toEqual([
      { name: "Maria da Silva", role: "Interessado(a)" },
      { name: "Operadora Exemplo", role: "Fornecedor" },
    ]);
    expect(d.chronology).toEqual([
      { date: "2026-05-10", description: "Compra ou contratação" },
      { date: "2026-09-27", description: "Atendimento de teste finalizado no Júris Office IA" },
    ]);
    expect(d.amounts).toHaveLength(1);
    expect(d.amounts[0].label).toBe("Valor envolvido");
    expect(d.amounts[0].value).toMatch(/^R\$\s119,90$/);
    expect(d.actionsTaken.map((a) => a.answer)).toEqual(["Sim", "2026000123", expect.any(String)]);
  });

  it("lista documentos com o nome da categoria e aponta os recomendados que faltam", () => {
    expect(d.documents).toEqual([
      { category: "Nota fiscal ou recibo", name: "nf.pdf" },
      { category: "Outros documentos", name: "print.png" },
    ]);
    expect(d.missingInformation).toContain(
      "Documento recomendado não registrado: Contrato ou termo de adesão",
    );
    expect(d.missingInformation).not.toContain(
      "Documento recomendado não registrado: Nota fiscal ou recibo",
    );
    expect(d.observations.some((o) => /nenhum arquivo foi recebido/.test(o))).toBe(true);
  });

  it("organiza a triagem pelas etapas, só com perguntas visíveis", () => {
    expect(d.triageSections.map((s) => s.title)).toEqual([
      "O produto ou serviço",
      "Valores e pagamento",
      "O problema",
      "Tentativas de solução",
    ]);
  });

  it("é determinístico", () => {
    const again = buildDossier(
      input("consumidor", consumidor, [doc("nota_fiscal", "nf.pdf"), doc("outros", "print.png")]),
    );
    expect({ ...again, documents: again.documents }).toEqual(d);
  });
});

describe("buildDossier — informações faltantes", () => {
  it("aponta opcionais não respondidas e ausência de datas", () => {
    const d = buildDossier(
      input("consumidor", {
        produto_servico: "Celular",
        fornecedor: "Loja X",
        pagamento_realizado: "total",
        problema: "Defeito",
        problema_continua: true,
        possui_comprovante: false,
        tentou_resolver: false,
      }),
    );
    expect(d.missingInformation).toContain("Não informado: Qual o valor envolvido?");
    expect(d.missingInformation).toContain("Datas dos fatos não informadas.");
    // Pergunta condicional oculta não é cobrada.
    expect(d.missingInformation.join(" ")).not.toMatch(/número de protocolo/);
    expect(d.observations.some((o) => /nenhum arquivo foi recebido/.test(o))).toBe(false);
  });

  it("parte fixa (INSS) entra só quando a resposta é sim", () => {
    const base = {
      beneficio: "aposentadoria",
      resultado: "negado",
      recurso_andamento: false,
      possui_cnis: true,
    };
    const sim = buildDossier(input("previdenciario", { ...base, requerimento_inss: true }));
    const nao = buildDossier(input("previdenciario", { ...base, requerimento_inss: false }));
    expect(sim.parties.map((p) => p.name)).toContain("INSS");
    expect(nao.parties.map((p) => p.name)).not.toContain("INSS");
  });
});

describe("summarize", () => {
  it("mantém textos curtos e normaliza espaços", () => {
    expect(summarize("  Olá\n\nmundo  ")).toBe("Olá mundo");
  });

  it("corta textos longos no fim de uma frase ou palavra", () => {
    const long = `${"Frase de teste com várias palavras. ".repeat(30)}`;
    const s = summarize(long);
    expect(s.length).toBeLessThanOrEqual(FACTS_SUMMARY_MAX + 1);
    expect(s.endsWith(".")).toBe(true);
    const noStops = summarize("palavra ".repeat(200));
    expect(noStops.endsWith("…")).toBe(true);
    expect(noStops).not.toMatch(/ …$/);
  });
});
