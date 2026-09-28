import type { CaseService } from "@/lib/services/case-service";

export const APPLICANT = {
  fullName: "Maria da Silva",
  email: "maria@example.com",
  phone: "11912345678",
  city: "Campinas",
  uf: "SP",
  consentAccepted: true,
};

export const CONSUMIDOR_TRIAGE = [
  {
    produto_servico: "Plano de internet",
    fornecedor: "Operadora Exemplo",
    data_contratacao: "2026-05-10",
  },
  { pagamento_realizado: "total", valor_envolvido: "119,90" },
  { problema: "Cobrança em dobro na fatura", problema_continua: "sim", possui_comprovante: "sim" },
  { tentou_resolver: "nao" },
];

export const NARRATIVE = "Em maio a operadora cobrou duas vezes a mesma fatura e não devolveu.";

export const pdf = (name: string, category = "outros") => ({
  category,
  name,
  size: 1000,
  mimeType: "application/pdf",
});

/** Cria um atendimento de Consumidor pronto para finalizar. */
export async function readyConsumidorCase(service: CaseService, owner?: string) {
  const c = await service.createCase("consumidor", owner);
  await service.saveApplicant(c.id, APPLICANT);
  for (const [i, raw] of CONSUMIDOR_TRIAGE.entries()) {
    const r = await service.saveTriageStep(c.id, i, raw);
    if (!r.ok) throw new Error(`etapa ${i}: ${r.message}`);
  }
  await service.saveNarrative(c.id, { narrative: NARRATIVE });
  await service.finishDocuments(c.id);
  return c;
}
