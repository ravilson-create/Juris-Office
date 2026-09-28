/**
 * Plano de teste das cinco áreas. As perguntas vêm das mesmas definições usadas pelo app;
 * aqui ficam só os valores e o que verificar em cada área.
 */
export interface AreaPlan {
  slug: string;
  name: string;
  /** Respostas válidas, no formato do formulário ("sim"/"nao", valores das opções). */
  answers: Record<string, string | string[]>;
  /** Validação exercitada: valor inválido, mensagem esperada e (opcional) correção relacionada. */
  invalid: {
    key: string;
    value: string;
    message: RegExp;
    fixOther?: { key: string; value: string };
  };
  /** Condicional verificada: a pergunta `reveals` só aparece com `trigger` = `when`. */
  conditional?: { trigger: string; when: string; otherwise: string; reveals: string };
  /** Correção feita pela revisão: etapa, pergunta, novo valor e texto esperado na revisão/dossiê. */
  correction: { key: string; value: string; shown: string | RegExp };
  /** Texto esperado no dossiê (parte, valor etc.). */
  dossierText: string | RegExp;
}

export const AREA_PLANS: AreaPlan[] = [
  {
    slug: "consumidor",
    name: "Consumidor",
    answers: {
      produto_servico: "Plano de internet",
      fornecedor: "Operadora Exemplo",
      data_contratacao: "2026-03-15",
      valor_envolvido: "1.234,56",
      pagamento_realizado: "total",
      cobranca_negativacao: ["cobranca"],
      problema: "Cobrança em dobro na fatura",
      problema_continua: "sim",
      possui_comprovante: "sim",
      tentou_resolver: "sim",
      numero_protocolo: "2026000123",
      houve_resposta: "nao_resolveu",
    },
    invalid: { key: "valor_envolvido", value: "1.2.3", message: /Use um valor como/ },
    conditional: {
      trigger: "tentou_resolver",
      when: "sim",
      otherwise: "nao",
      reveals: "numero_protocolo",
    },
    correction: { key: "valor_envolvido", value: "2.000,00", shown: /R\$\s2\.000,00/ },
    dossierText: "Operadora Exemplo — Fornecedor",
  },
  {
    slug: "trabalhista",
    name: "Trabalhista",
    answers: {
      empregador: "Empresa Exemplo Ltda",
      funcao: "Auxiliar administrativo",
      data_inicio: "2020-03-01",
      ainda_trabalha: "nao",
      data_termino: "2024-01-10",
      registro_formal: "sim",
      remuneracao: "2.500,00",
      jornada: "Das 8h às 17h",
      controle_ponto: "sim",
      valores_nao_pagos: ["horas_extras"],
      forma_desligamento: "sem_justa_causa",
      documentos_rescisorios: "nao",
      possui_comprovantes: "sim",
    },
    // Término antes do início; corrigir o INÍCIO (não o término) precisa limpar o erro.
    invalid: {
      key: "data_termino",
      value: "2019-01-10",
      message: /anterior à data de início/,
      fixOther: { key: "data_inicio", value: "2018-06-01" },
    },
    conditional: {
      trigger: "ainda_trabalha",
      when: "nao",
      otherwise: "sim",
      reveals: "data_termino",
    },
    correction: { key: "remuneracao", value: "3.000,00", shown: /R\$\s3\.000,00/ },
    dossierText: "Empresa Exemplo Ltda — Empregador",
  },
  {
    slug: "familia",
    name: "Família",
    answers: {
      assunto: "pensao",
      pessoas_envolvidas: "Ex-cônjuge e dois filhos",
      filhos_menores: "sim",
      quantidade_filhos: "2",
      relacao: "casamento",
      processo_existente: "nao",
      acordo_anterior: "nao",
      bens_obrigacoes: "sim",
      urgencia: "sim",
      urgencia_descricao: "Pensão atrasada há três meses",
      documentos_disponiveis: "Certidões de nascimento",
    },
    invalid: { key: "quantidade_filhos", value: "1,5", message: /inteiro/ },
    conditional: {
      trigger: "filhos_menores",
      when: "sim",
      otherwise: "nao",
      reveals: "quantidade_filhos",
    },
    correction: {
      key: "urgencia_descricao",
      value: "Pensão atrasada há quatro meses",
      shown: "Pensão atrasada há quatro meses",
    },
    dossierText: /Ex-cônjuge e dois filhos/,
  },
  {
    slug: "previdenciario",
    name: "Previdenciário",
    answers: {
      beneficio: "aposentadoria",
      requerimento_inss: "sim",
      data_requerimento: "2025-06-01",
      numero_beneficio: "1234567890",
      resultado: "negado",
      motivo_informado: "Tempo de contribuição insuficiente",
      recurso_andamento: "nao",
      possui_cnis: "sim",
      outros_documentos: ["ctps"],
    },
    invalid: { key: "data_requerimento", value: "2099-01-01", message: /futuro/ },
    conditional: {
      trigger: "resultado",
      when: "negado",
      otherwise: "aguardando",
      reveals: "motivo_informado",
    },
    correction: { key: "motivo_informado", value: "Falta de carência", shown: "Falta de carência" },
    dossierText: "INSS — Órgão",
  },
  {
    slug: "civel",
    name: "Cível",
    answers: {
      tipo_conflito: "contrato",
      partes: "Vizinho Exemplo",
      inicio_fatos: "2025-01-10",
      existe_contrato: "sim",
      valor_envolvido: "5000",
      houve_pagamento: "sim",
      notificacao_acordo: "sim",
      processo_existente: "nao",
      documentos: "Contrato assinado",
    },
    invalid: { key: "valor_envolvido", value: "1.2345", message: /Use um valor como/ },
    correction: { key: "partes", value: "Vizinho Corrigido", shown: "Vizinho Corrigido" },
    dossierText: /R\$\s5\.000,00/,
  },
];
