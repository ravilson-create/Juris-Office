import type { LegalAreaSlug } from "@/domain/legal-area/schema";
import type { DossierHint } from "@/domain/triage/schema";

/**
 * Indica como cada resposta alimenta o dossiê. Fica separado das perguntas para facilitar
 * ajustes sem mexer no conteúdo da triagem. Chaves: slug da área → chave da pergunta.
 */
export const DOSSIER_HINTS: Record<LegalAreaSlug, Record<string, DossierHint>> = {
  consumidor: {
    fornecedor: { kind: "party", role: "Fornecedor" },
    data_contratacao: { kind: "date", event: "Compra ou contratação" },
    valor_envolvido: { kind: "amount", label: "Valor envolvido" },
    tentou_resolver: { kind: "action" },
    numero_protocolo: { kind: "action" },
    houve_resposta: { kind: "action" },
  },
  trabalhista: {
    empregador: { kind: "party", role: "Empregador" },
    data_inicio: { kind: "date", event: "Início do trabalho" },
    data_termino: { kind: "date", event: "Fim do trabalho" },
    remuneracao: { kind: "amount", label: "Remuneração mensal" },
  },
  familia: {
    pessoas_envolvidas: { kind: "party", role: "Pessoas envolvidas (conforme informado)" },
    processo_existente: { kind: "action" },
    acordo_anterior: { kind: "action" },
  },
  previdenciario: {
    requerimento_inss: { kind: "party", role: "Órgão", fixedName: "INSS" },
    data_requerimento: { kind: "date", event: "Pedido ao INSS" },
    numero_beneficio: { kind: "action" },
    resultado: { kind: "action" },
    recurso_andamento: { kind: "action" },
  },
  civel: {
    partes: { kind: "party", role: "Partes envolvidas (conforme informado)" },
    inicio_fatos: { kind: "date", event: "Início dos fatos" },
    valor_envolvido: { kind: "amount", label: "Valor envolvido" },
    notificacao_acordo: { kind: "action" },
    processo_existente: { kind: "action" },
  },
};
