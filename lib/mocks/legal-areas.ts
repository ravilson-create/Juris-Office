import type { LegalArea, LegalAreaSlug } from "@/domain/legal-area/schema";
import { stableId } from "@/lib/utils/stable-id";

export const areaId = (slug: LegalAreaSlug) => stableId(`area:${slug}`);

export const LEGAL_AREAS: LegalArea[] = [
  {
    id: areaId("consumidor"),
    slug: "consumidor",
    name: "Consumidor",
    description: "Problemas com compras, serviços, cobranças, bancos e planos.",
    examples: ["Produto com defeito", "Cobrança indevida", "Nome negativado"],
    active: true,
    sortOrder: 1,
  },
  {
    id: areaId("trabalhista"),
    slug: "trabalhista",
    name: "Trabalhista",
    description: "Questões com empregador: salário, jornada, demissão e verbas.",
    examples: ["Horas extras", "Rescisão não paga", "Trabalho sem registro"],
    active: true,
    sortOrder: 2,
  },
  {
    id: areaId("familia"),
    slug: "familia",
    name: "Família",
    description: "Pensão, guarda, convivência, divórcio e união estável.",
    examples: ["Pensão alimentícia", "Guarda dos filhos", "Divórcio"],
    active: true,
    sortOrder: 3,
  },
  {
    id: areaId("previdenciario"),
    slug: "previdenciario",
    name: "Previdenciário",
    description: "Benefícios do INSS: aposentadoria, auxílios e revisões.",
    examples: ["Benefício negado", "Aposentadoria", "Auxílio por incapacidade"],
    active: true,
    sortOrder: 4,
  },
  {
    id: areaId("civel"),
    slug: "civel",
    name: "Cível",
    description: "Contratos, dívidas, danos, aluguel e conflitos entre pessoas.",
    examples: ["Contrato descumprido", "Dívida a receber", "Problema com aluguel"],
    active: true,
    sortOrder: 5,
  },
];
