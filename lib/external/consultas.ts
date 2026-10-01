import type { LegalAreaSlug } from "@/domain/legal-area/schema";

/**
 * Registro dos sistemas de consulta externa citados no roteiro do produto
 * (PJe, Escritório Digital, e-DOU, Jusbrasil, Turivius, Jusfy).
 *
 * Nenhum deles oferece hoje uma API pública aberta para um sistema terceiro consultar em nome do
 * advogado sem contrato comercial ou certificado digital — a única exceção é a API Pública do
 * DataJud (CNJ), tratada à parte em lib/external/datajud.ts. Por isso esta lista só gera links:
 * o advogado é sempre quem decide pesquisar e o que digitar, e nenhum dado do cidadão (nome,
 * relato, documentos) é enviado automaticamente a nenhum desses sites — só o termo genérico da
 * área jurídica (nunca dado pessoal) entra na URL, quando o serviço aceitar busca por query.
 */
export type ServicoConsulta = {
  id: string;
  nome: string;
  descricao: string;
  /** Por que não há integração automática (API/certificado/contrato) — mostrado na tela. */
  motivoSemIntegracao: string;
  /** Sem área escolhida, cai na página inicial de busca — nunca manda dado pessoal. */
  url: (areaSlug?: LegalAreaSlug) => string;
};

export const TERMO_POR_AREA: Record<LegalAreaSlug, string> = {
  consumidor: "direito do consumidor",
  trabalhista: "direito trabalhista",
  familia: "direito de família",
  previdenciario: "direito previdenciário",
  civel: "direito civil",
};

export const SERVICOS_JURISPRUDENCIA: ServicoConsulta[] = [
  {
    id: "jusbrasil",
    nome: "Jusbrasil",
    descricao: "Busca de jurisprudência, legislação e notícias jurídicas.",
    motivoSemIntegracao: "Não publica API aberta para consulta por terceiros.",
    url: (area) =>
      area
        ? `https://www.jusbrasil.com.br/jurisprudencia/busca?q=${encodeURIComponent(TERMO_POR_AREA[area])}`
        : "https://www.jusbrasil.com.br/jurisprudencia",
  },
  {
    id: "turivius",
    nome: "Turivius",
    descricao: "Plataforma de inteligência jurisprudencial e monitoramento de teses.",
    motivoSemIntegracao: "Acesso é por contrato comercial, sem API pública.",
    url: () => "https://www.turivius.com",
  },
  {
    id: "jusfy",
    nome: "Jusfy",
    descricao: "Ferramentas de IA para pesquisa jurídica e redação de peças.",
    motivoSemIntegracao: "Acesso é por contrato comercial, sem API pública.",
    url: () => "https://jusfy.com.br",
  },
];

export const SERVICO_DOU: ServicoConsulta = {
  id: "edou",
  nome: "Diário Oficial da União (e-DOU)",
  descricao: "Pesquisa de publicações oficiais pela Imprensa Nacional.",
  motivoSemIntegracao: "Busca pública, mas sem API aberta para consulta automatizada.",
  url: (area) =>
    area
      ? `https://www.in.gov.br/consulta/-/buscar/dou?q=${encodeURIComponent(TERMO_POR_AREA[area])}`
      : "https://www.in.gov.br/consulta/-/buscar/dou",
};

export type ServicoProcessual = {
  id: string;
  nome: string;
  descricao: string;
  motivoSemIntegracao: string;
  url: string;
};

/**
 * PJe e Escritório Digital exigem certificado digital ou conta gov.br do próprio advogado/parte
 * em cada tribunal — não há um ponto único de API pública para consulta por número de processo.
 * Por isso ficam só como link para o portal oficial; o advogado entra com suas próprias
 * credenciais e usa o número do processo que ele mesmo tem em mãos.
 */
export const SERVICOS_PROCESSUAIS: ServicoProcessual[] = [
  {
    id: "pje",
    nome: "PJe — Processo Judicial Eletrônico",
    descricao: "Acesso processual nos tribunais que usam o PJe.",
    motivoSemIntegracao:
      "Cada tribunal tem sua própria instância do PJe, com login por certificado digital.",
    url: "https://www.pje.jus.br",
  },
];
