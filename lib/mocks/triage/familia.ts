import { defineQuestions } from "./builder";

export const FAMILIA_QUESTIONS = defineQuestions("familia", [
  {
    title: "O assunto",
    questions: [
      {
        key: "assunto",
        label: "Qual é o assunto principal?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Pensão alimentícia", value: "pensao" },
          { label: "Guarda ou convivência com filhos", value: "guarda" },
          { label: "Divórcio ou separação", value: "divorcio" },
          { label: "União estável", value: "uniao_estavel" },
          { label: "Partilha de bens", value: "partilha" },
          { label: "Outro assunto de família", value: "outro" },
        ],
      },
      {
        key: "pessoas_envolvidas",
        label: "Quem são as pessoas envolvidas?",
        helpText: "Indique o vínculo, por exemplo: ex-marido, filho de 8 anos.",
        type: "textarea",
        required: true,
        constraints: { maxLength: 800 },
      },
      {
        key: "filhos_menores",
        label: "Há filhos menores de idade ou dependentes envolvidos?",
        type: "boolean",
        required: true,
      },
      {
        key: "quantidade_filhos",
        label: "Quantos filhos menores ou dependentes?",
        type: "number",
        required: true,
        showIf: { questionKey: "filhos_menores", equals: true },
        constraints: { min: 1, max: 20, integer: true },
      },
    ],
  },
  {
    title: "Situação atual",
    questions: [
      {
        key: "relacao",
        label: "Existe ou existiu casamento ou união estável?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Casamento", value: "casamento" },
          { label: "União estável", value: "uniao" },
          { label: "Nenhum dos dois", value: "nenhum" },
        ],
      },
      {
        key: "processo_existente",
        label: "Já existe processo ou decisão da Justiça sobre o assunto?",
        type: "boolean",
        required: true,
      },
      {
        key: "acordo_anterior",
        label: "Existe acordo anterior entre as partes?",
        type: "boolean",
        required: true,
      },
      {
        key: "bens_obrigacoes",
        label: "Existem bens ou obrigações financeiras relevantes?",
        helpText: "Imóvel, veículo, dívidas em comum, pensão já paga.",
        type: "boolean",
        required: true,
      },
    ],
  },
  {
    title: "Urgência e documentos",
    questions: [
      {
        key: "urgencia",
        label: "Há alguma urgência?",
        helpText: "Por exemplo: prazo, falta de sustento, impedimento de convivência.",
        type: "boolean",
        required: true,
      },
      {
        key: "urgencia_descricao",
        label: "Descreva a urgência",
        type: "textarea",
        required: true,
        showIf: { questionKey: "urgencia", equals: true },
        constraints: { maxLength: 800 },
      },
      {
        key: "documentos_disponiveis",
        label: "Quais documentos você tem?",
        type: "text",
        required: false,
        helpText: "Certidões, acordos, comprovantes de despesas.",
      },
    ],
  },
]);
