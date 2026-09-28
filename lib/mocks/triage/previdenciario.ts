import { defineQuestions } from "./builder";

export const PREVIDENCIARIO_QUESTIONS = defineQuestions("previdenciario", [
  {
    title: "O benefício",
    questions: [
      {
        key: "beneficio",
        label: "Qual benefício ou questão está envolvida?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Aposentadoria", value: "aposentadoria" },
          { label: "Auxílio por incapacidade", value: "incapacidade" },
          { label: "Pensão por morte", value: "pensao_morte" },
          { label: "BPC/LOAS", value: "bpc" },
          { label: "Salário-maternidade", value: "maternidade" },
          { label: "Revisão de benefício", value: "revisao" },
          { label: "Outro", value: "outro" },
        ],
      },
      {
        key: "requerimento_inss",
        label: "Você já fez pedido ao INSS?",
        type: "boolean",
        required: true,
      },
      {
        key: "data_requerimento",
        label: "Qual a data do pedido?",
        type: "date",
        required: false,
        showIf: { questionKey: "requerimento_inss", equals: true },
        constraints: { notFuture: true },
      },
      {
        key: "numero_beneficio",
        label: "Número do benefício ou protocolo",
        type: "text",
        required: false,
        showIf: { questionKey: "requerimento_inss", equals: true },
      },
    ],
  },
  {
    title: "Decisão do INSS",
    questions: [
      {
        key: "resultado",
        label: "Qual foi o resultado?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Ainda aguardando", value: "aguardando" },
          { label: "Negado", value: "negado" },
          { label: "Concedido, mas discordo do valor", value: "valor" },
          { label: "Concedido e depois cortado", value: "cessado" },
          { label: "Ainda não pedi", value: "nao_pedi" },
        ],
      },
      {
        key: "motivo_informado",
        label: "Qual motivo o INSS informou?",
        type: "textarea",
        required: false,
        showIf: { questionKey: "resultado", equals: "negado" },
        constraints: { maxLength: 800 },
      },
      {
        key: "recurso_andamento",
        label: "Existe recurso ou prazo em andamento?",
        type: "boolean",
        required: true,
      },
    ],
  },
  {
    title: "Documentos",
    questions: [
      {
        key: "possui_cnis",
        label: "Você tem o extrato do CNIS?",
        helpText: "É o extrato de contribuições, disponível no Meu INSS.",
        type: "boolean",
        required: true,
      },
      {
        key: "outros_documentos",
        label: "Quais outros documentos você tem?",
        type: "multiple_choice",
        required: false,
        options: [
          { label: "Carteira de trabalho", value: "ctps" },
          { label: "Carnês ou guias de contribuição", value: "guias" },
          { label: "Laudos e atestados médicos", value: "laudos" },
          { label: "Carta de decisão do INSS", value: "carta" },
        ],
      },
    ],
  },
]);
