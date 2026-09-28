import { describe, expect, it } from "vitest";
import {
  buildSteps,
  completion,
  formatAnswer,
  parseCurrency,
  toFormValue,
  validateStep,
} from "@/domain/triage/engine";
import { triageQuestionSchema } from "@/domain/triage/schema";
import { CONSUMIDOR_QUESTIONS } from "@/lib/mocks/triage/consumidor";

const TODAY = new Date("2026-09-27T12:00:00Z");
const steps = buildSteps(CONSUMIDOR_QUESTIONS);
const byKey = (k: string) => CONSUMIDOR_QUESTIONS.find((q) => q.key === k)!;

describe("dados de triagem", () => {
  it("todas as perguntas de Consumidor são válidas pelo schema", () => {
    for (const q of CONSUMIDOR_QUESTIONS)
      expect(triageQuestionSchema.safeParse(q).success).toBe(true);
  });

  it("agrupa as perguntas em etapas pela seção, na ordem", () => {
    expect(steps.map((s) => s.title)).toEqual([
      "O produto ou serviço",
      "Valores e pagamento",
      "O problema",
      "Tentativas de solução",
    ]);
  });
});

describe("parseCurrency", () => {
  it.each([
    ["1.250,00", 1250],
    ["R$ 1.250,5", 1250.5],
    ["1250.99", 1250.99],
    ["1.000", 1000],
    ["abc", null],
  ])("%s → %s", (input, expected) => expect(parseCurrency(input)).toBe(expected));
});

describe("validateStep", () => {
  it("exige perguntas obrigatórias", () => {
    const r = validateStep(steps[0].questions, {}, {}, TODAY);
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors)).toEqual(["produto_servico", "fornecedor"]);
  });

  it("rejeita data futura quando a regra exige", () => {
    const r = validateStep(
      steps[0].questions,
      { produto_servico: "Celular", fornecedor: "Loja X", data_contratacao: "2027-01-01" },
      {},
      TODAY,
    );
    expect(r.errors.data_contratacao).toBe("A data não pode estar no futuro.");
  });

  it("converte valores tipados", () => {
    const r = validateStep(
      steps[1].questions,
      {
        valor_envolvido: "2.399,90",
        pagamento_realizado: "total",
        cobranca_negativacao: ["cobranca"],
      },
      {},
      TODAY,
    );
    expect(r.valid).toBe(true);
    expect(r.values).toEqual({
      valor_envolvido: 2399.9,
      pagamento_realizado: "total",
      cobranca_negativacao: ["cobranca"],
    });
  });

  it("oculta perguntas condicionais e descarta suas respostas", () => {
    const r = validateStep(
      steps[3].questions,
      { tentou_resolver: "nao", numero_protocolo: "123", houve_resposta: "parcial" },
      {},
      TODAY,
    );
    expect(r.valid).toBe(true);
    expect(r.values).toEqual({ tentou_resolver: false });
    expect(r.hiddenKeys).toEqual(["numero_protocolo", "houve_resposta"]);
  });

  it("exige pergunta condicional obrigatória quando visível", () => {
    const r = validateStep(steps[3].questions, { tentou_resolver: "sim" }, {}, TODAY);
    expect(r.errors).toEqual({ houve_resposta: "Responda esta pergunta para continuar." });
  });

  it("rejeita opção fora da lista", () => {
    const r = validateStep(steps[1].questions, { pagamento_realizado: "talvez" }, {}, TODAY);
    expect(r.errors.pagamento_realizado).toBe("Escolha uma das opções.");
  });
});

describe("conversões de exibição", () => {
  it("formata respostas para revisão", () => {
    expect(formatAnswer(byKey("valor_envolvido"), 1250)).toBe("R$\u00a01.250,00");
    expect(formatAnswer(byKey("data_contratacao"), "2026-03-15")).toBe("15/03/2026");
    expect(formatAnswer(byKey("tentou_resolver"), false)).toBe("Não");
    expect(formatAnswer(byKey("pagamento_realizado"), "parcial")).toBe("Sim, em parte");
    expect(formatAnswer(byKey("fornecedor"), undefined)).toBe("Não informado");
  });

  it("devolve respostas ao formato do formulário (retomar)", () => {
    expect(toFormValue(byKey("tentou_resolver"), true)).toBe("sim");
    expect(toFormValue(byKey("valor_envolvido"), 1250.5)).toBe("1.250,50");
    expect(toFormValue(byKey("cobranca_negativacao"), undefined)).toEqual([]);
  });

  it("calcula o percentual de obrigatórias respondidas", () => {
    expect(completion(CONSUMIDOR_QUESTIONS, {})).toBe(0);
    const all = {
      produto_servico: "x",
      fornecedor: "y",
      pagamento_realizado: "total",
      problema: "z",
      problema_continua: true,
      possui_comprovante: true,
      tentou_resolver: false,
    };
    expect(completion(CONSUMIDOR_QUESTIONS, all)).toBe(100);
  });
});
