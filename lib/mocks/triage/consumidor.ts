import { defineQuestions } from "./builder";

export const CONSUMIDOR_QUESTIONS = defineQuestions("consumidor", [
  {
    title: "O produto ou serviço",
    questions: [
      {
        key: "produto_servico",
        label: "Qual produto ou serviço está relacionado ao problema?",
        helpText: "Por exemplo: celular, plano de internet, conta de luz, empréstimo.",
        type: "text",
        required: true,
      },
      {
        key: "fornecedor",
        label: "Quem é o fornecedor?",
        helpText: "Nome da loja, empresa, banco ou prestador do serviço.",
        type: "text",
        required: true,
      },
      {
        key: "data_contratacao",
        label: "Quando ocorreu a compra ou contratação?",
        helpText: "Se não souber o dia exato, informe uma data aproximada.",
        type: "date",
        required: false,
        constraints: { notFuture: true },
      },
    ],
  },
  {
    title: "Valores e pagamento",
    questions: [
      {
        key: "valor_envolvido",
        label: "Qual o valor envolvido?",
        helpText: "Valor aproximado em reais, por exemplo 1.250,00.",
        type: "currency",
        required: false,
      },
      {
        key: "pagamento_realizado",
        label: "O pagamento foi realizado?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Sim, totalmente", value: "total" },
          { label: "Sim, em parte", value: "parcial" },
          { label: "Não", value: "nao" },
        ],
      },
      {
        key: "cobranca_negativacao",
        label: "Existe alguma destas situações?",
        helpText: "Marque todas que se aplicam. Se nenhuma, deixe em branco.",
        type: "multiple_choice",
        required: false,
        options: [
          { label: "Cobrança que considero indevida", value: "cobranca" },
          { label: "Nome negativado (SPC/Serasa)", value: "negativacao" },
          { label: "Serviço interrompido ou cortado", value: "interrupcao" },
        ],
      },
    ],
  },
  {
    title: "O problema",
    questions: [
      {
        key: "problema",
        label: "Qual foi o problema encontrado?",
        helpText:
          "Descreva em poucas linhas. Você poderá contar com mais detalhes na etapa de relato.",
        type: "textarea",
        required: true,
        constraints: { maxLength: 1000 },
      },
      {
        key: "problema_continua",
        label: "O problema ainda está acontecendo?",
        type: "boolean",
        required: true,
      },
      {
        key: "possui_comprovante",
        label: "Você tem contrato, nota fiscal ou comprovante?",
        type: "boolean",
        required: true,
      },
    ],
  },
  {
    title: "Tentativas de solução",
    questions: [
      {
        key: "tentou_resolver",
        label: "Você tentou resolver diretamente com o fornecedor?",
        type: "boolean",
        required: true,
      },
      {
        key: "numero_protocolo",
        label: "Há número de protocolo do atendimento?",
        helpText: "Se tiver mais de um, informe o mais recente.",
        type: "text",
        required: false,
        showIf: { questionKey: "tentou_resolver", equals: true },
      },
      {
        key: "houve_resposta",
        label: "O fornecedor respondeu?",
        type: "single_choice",
        required: true,
        showIf: { questionKey: "tentou_resolver", equals: true },
        options: [
          { label: "Não respondeu", value: "sem_resposta" },
          { label: "Respondeu, mas não resolveu", value: "nao_resolveu" },
          { label: "Resolveu em parte", value: "parcial" },
        ],
      },
    ],
  },
]);
