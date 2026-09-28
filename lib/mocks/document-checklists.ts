import type { LegalAreaSlug } from "@/domain/legal-area/schema";
import type { DocumentChecklistItem } from "@/domain/document/schema";
import { areaId } from "@/lib/mocks/legal-areas";
import { stableId } from "@/lib/utils/stable-id";

type Seed = Pick<DocumentChecklistItem, "category" | "label" | "description" | "recommended">;

function define(slug: LegalAreaSlug, items: Seed[]): DocumentChecklistItem[] {
  return items.map((item, i) => ({
    ...item,
    id: stableId(`doc:${slug}:${item.category}`),
    legalAreaId: areaId(slug),
    sortOrder: (i + 1) * 10,
  }));
}

/**
 * Checklists iniciais por área (ponto de partida para testes, não conclusão jurídica).
 * Documentos são opcionais: o cliente envia o que tiver e o advogado pede o restante.
 */
export const DOCUMENT_CHECKLISTS: DocumentChecklistItem[] = [
  ...define("consumidor", [
    {
      category: "contrato",
      label: "Contrato ou termo de adesão",
      description: "Contrato assinado, termos aceitos no site ou proposta.",
      recommended: true,
    },
    {
      category: "nota_fiscal",
      label: "Nota fiscal ou recibo",
      description: "Comprova a compra ou a contratação.",
      recommended: true,
    },
    {
      category: "comprovantes",
      label: "Comprovantes de pagamento",
      description: "Boletos, faturas, extratos ou comprovantes de Pix.",
      recommended: true,
    },
    {
      category: "conversas",
      label: "Conversas e e-mails",
      description: "Prints de WhatsApp, chats ou e-mails com o fornecedor.",
      recommended: false,
    },
    {
      category: "protocolos",
      label: "Protocolos de atendimento",
      description: "Números ou comprovantes de reclamações feitas.",
      recommended: false,
    },
  ]),
  ...define("trabalhista", [
    {
      category: "contrato_trabalho",
      label: "Contrato de trabalho",
      description: "Contrato assinado ou carta de admissão.",
      recommended: true,
    },
    {
      category: "ctps",
      label: "Carteira de trabalho (CTPS)",
      description: "Páginas com os registros ou a CTPS digital.",
      recommended: true,
    },
    {
      category: "holerites",
      label: "Holerites",
      description: "Recibos de pagamento de salário.",
      recommended: true,
    },
    {
      category: "controle_jornada",
      label: "Controles de jornada",
      description: "Cartões de ponto, registros ou mensagens com horários.",
      recommended: false,
    },
    {
      category: "rescisao",
      label: "Documentos da rescisão",
      description: "Termo de rescisão, aviso prévio e guias.",
      recommended: false,
    },
  ]),
  ...define("familia", [
    {
      category: "certidoes",
      label: "Certidões",
      description: "Nascimento dos filhos, casamento ou união estável.",
      recommended: true,
    },
    {
      category: "documentos_vinculo",
      label: "Documentos do vínculo",
      description: "Acordos, escrituras ou declarações existentes.",
      recommended: false,
    },
    {
      category: "decisoes",
      label: "Decisões ou processos anteriores",
      description: "Sentenças, acordos homologados ou número de processo.",
      recommended: false,
    },
    {
      category: "comprovantes_despesas",
      label: "Comprovantes de despesas e renda",
      description: "Escola, saúde, moradia e comprovantes de renda.",
      recommended: true,
    },
  ]),
  ...define("previdenciario", [
    {
      category: "documentos_inss",
      label: "Documentos do INSS",
      description: "Requerimento, carta de indeferimento ou concessão.",
      recommended: true,
    },
    {
      category: "cnis",
      label: "Extrato CNIS",
      description: "Extrato de contribuições (disponível no Meu INSS).",
      recommended: true,
    },
    {
      category: "decisoes_inss",
      label: "Decisões e recursos",
      description: "Decisões administrativas e recursos apresentados.",
      recommended: false,
    },
    {
      category: "laudos",
      label: "Laudos e documentos médicos",
      description: "Quando o benefício depender de condição de saúde.",
      recommended: false,
    },
  ]),
  ...define("civel", [
    {
      category: "contratos",
      label: "Contratos",
      description: "Contrato, acordo ou documento que regula a relação.",
      recommended: true,
    },
    {
      category: "notificacoes",
      label: "Notificações",
      description: "Notificações enviadas ou recebidas.",
      recommended: false,
    },
    {
      category: "comprovantes",
      label: "Comprovantes",
      description: "Pagamentos, recibos e transferências.",
      recommended: true,
    },
    {
      category: "comunicacoes",
      label: "Comunicações",
      description: "Mensagens, e-mails e cartas sobre o fato.",
      recommended: false,
    },
  ]),
];
