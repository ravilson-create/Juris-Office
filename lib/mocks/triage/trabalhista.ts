import { defineQuestions } from "./builder";

export const TRABALHISTA_QUESTIONS = defineQuestions("trabalhista", [
  {
    title: "O vínculo de trabalho",
    questions: [
      {
        key: "empregador",
        label: "Qual era (ou é) o empregador?",
        helpText: "Nome da empresa ou da pessoa que contratou.",
        type: "text",
        required: true,
      },
      { key: "funcao", label: "Qual função você exercia?", type: "text", required: true },
      {
        key: "data_inicio",
        label: "Quando começou a trabalhar?",
        type: "date",
        required: true,
        constraints: { notFuture: true },
      },
      { key: "ainda_trabalha", label: "Você ainda trabalha lá?", type: "boolean", required: true },
      {
        key: "data_termino",
        label: "Quando terminou o trabalho?",
        type: "date",
        required: true,
        showIf: { questionKey: "ainda_trabalha", equals: false },
        constraints: {
          notFuture: true,
          notBefore: { key: "data_inicio", label: "data de início do trabalho" },
        },
      },
      {
        key: "registro_formal",
        label: "O trabalho era registrado em carteira?",
        type: "single_choice",
        required: true,
        options: [
          { label: "Sim, desde o início", value: "sim" },
          { label: "Só depois de um tempo", value: "parcial" },
          { label: "Não era registrado", value: "nao" },
        ],
      },
    ],
  },
  {
    title: "Remuneração e jornada",
    questions: [
      {
        key: "remuneracao",
        label: "Qual era a remuneração mensal?",
        helpText: "Valor aproximado em reais.",
        type: "currency",
        required: false,
      },
      {
        key: "jornada",
        label: "Qual era a jornada habitual?",
        helpText: "Por exemplo: segunda a sexta, das 8h às 18h.",
        type: "text",
        required: false,
      },
      { key: "controle_ponto", label: "Havia controle de ponto?", type: "boolean", required: true },
      {
        key: "valores_nao_pagos",
        label: "Existem valores que você entende não terem sido pagos?",
        helpText: "Marque todas que se aplicam.",
        type: "multiple_choice",
        required: false,
        options: [
          { label: "Horas extras", value: "horas_extras" },
          { label: "Férias", value: "ferias" },
          { label: "13º salário", value: "decimo_terceiro" },
          { label: "FGTS", value: "fgts" },
          { label: "Verbas da rescisão", value: "rescisao" },
          { label: "Outros", value: "outros" },
        ],
      },
    ],
  },
  {
    title: "Desligamento e documentos",
    questions: [
      {
        key: "forma_desligamento",
        label: "Como foi o desligamento?",
        type: "single_choice",
        required: true,
        showIf: { questionKey: "ainda_trabalha", equals: false },
        options: [
          { label: "Fui demitido sem justa causa", value: "sem_justa_causa" },
          { label: "Fui demitido por justa causa", value: "justa_causa" },
          { label: "Pedi demissão", value: "pedido" },
          { label: "Acordo com o empregador", value: "acordo" },
          { label: "Não sei informar", value: "nao_sei" },
        ],
      },
      {
        key: "documentos_rescisorios",
        label: "Você recebeu os documentos da rescisão?",
        type: "boolean",
        required: true,
        showIf: { questionKey: "ainda_trabalha", equals: false },
      },
      {
        key: "possui_comprovantes",
        label: "Você tem documentos da relação de trabalho?",
        helpText: "Carteira de trabalho, holerites, mensagens, controles de ponto.",
        type: "boolean",
        required: true,
      },
    ],
  },
]);
