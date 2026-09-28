import { defineQuestions } from "./builder";

export const CIVEL_QUESTIONS = defineQuestions("civel", [
  {
    title: "O conflito",
    questions: [
      {
        key: "tipo_conflito",
        label: "Qual é o tipo de conflito?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Contrato não cumprido", value: "contrato" },
          { label: "Dívida a receber ou a pagar", value: "divida" },
          { label: "Danos materiais ou morais", value: "danos" },
          { label: "Aluguel ou imóvel", value: "imovel" },
          { label: "Vizinhança", value: "vizinhanca" },
          { label: "Outro", value: "outro" },
        ],
      },
      {
        key: "partes",
        label: "Quem são as partes envolvidas?",
        helpText: "Você e a outra pessoa ou empresa.",
        type: "text",
        required: true,
      },
      {
        key: "inicio_fatos",
        label: "Quando os fatos começaram?",
        type: "date",
        required: false,
        constraints: { notFuture: true },
      },
    ],
  },
  {
    title: "Contrato e valores",
    questions: [
      {
        key: "existe_contrato",
        label: "Existe contrato, escrito ou verbal?",
        type: "boolean",
        required: true,
      },
      {
        key: "valor_envolvido",
        label: "Qual o valor envolvido?",
        type: "currency",
        required: false,
      },
      { key: "houve_pagamento", label: "Houve algum pagamento?", type: "boolean", required: true },
    ],
  },
  {
    title: "Tentativas e prazos",
    questions: [
      {
        key: "notificacao_acordo",
        label: "Houve notificação ou tentativa de acordo?",
        type: "boolean",
        required: true,
      },
      {
        key: "processo_existente",
        label: "Já existe processo sobre o assunto?",
        type: "boolean",
        required: true,
      },
      {
        key: "prazo_conhecido",
        label: "Existe algum prazo que você conheça?",
        helpText: "Por exemplo: data de audiência, vencimento, despejo.",
        type: "text",
        required: false,
      },
      {
        key: "documentos",
        label: "Quais documentos comprovam os fatos?",
        type: "text",
        required: false,
      },
    ],
  },
]);
