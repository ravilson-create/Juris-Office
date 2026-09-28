import { describe, expect, it } from "vitest";
import {
  buildSteps,
  completion,
  findConditionalCycle,
  firstIncompleteStep,
  parseAnswer,
  reconcileAnswers,
  validateStep,
} from "@/domain/triage/engine";
import type { TriageQuestion } from "@/domain/triage/schema";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { ALL_TRIAGE_QUESTIONS } from "@/lib/mocks/triage";

const byKey = (k: string) => ALL_TRIAGE_QUESTIONS.find((q) => q.key === k)!;
const TODAY = new Date("2026-09-27T15:00:00Z");

describe("número inteiro (quantidade de filhos)", () => {
  const q = byKey("quantidade_filhos");
  it.each(["1,5", "1.5", "2,0", "abc", "-1", "0", "21", " "])("recusa %j", (v) => {
    expect(parseAnswer(q, v).ok).toBe(false);
  });
  it.each([
    ["1", 1],
    ["20", 20],
    [" 3 ", 3],
  ])("aceita %j", (v, n) => {
    expect(parseAnswer(q, v)).toEqual({ ok: true, value: n });
  });
  it("mensagem explica o problema do fracionário", () => {
    const r = parseAnswer(q, "1,5");
    expect(!r.ok && r.error).toMatch(/inteiro/);
  });
  it("perguntas numéricas sem a regra continuam aceitando decimais", () => {
    const decimal = { ...q, constraints: { min: 0, max: 10 } } as TriageQuestion;
    expect(parseAnswer(decimal, "1,5")).toEqual({ ok: true, value: 1.5 });
    expect(parseAnswer(decimal, "1.2.3").ok).toBe(false);
  });
});

describe("datas relacionadas (início e término do trabalho)", () => {
  const step = buildSteps(
    ALL_TRIAGE_QUESTIONS.filter((q) => q.legalAreaId === byKey("empregador").legalAreaId),
  )[0];
  const base = { empregador: "E", funcao: "F", ainda_trabalha: "nao", registro_formal: "sim" };

  it("término antes do início é recusado, com erro no campo de término", () => {
    const r = validateStep(
      step.questions,
      { ...base, data_inicio: "2025-03-01", data_termino: "2020-01-10" },
      {},
      TODAY,
    );
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors)).toEqual(["data_termino"]);
    expect(r.errors.data_termino).toMatch(/anterior à data de início.*01\/03\/2025/);
  });

  it("datas iguais e término posterior são aceitos", () => {
    for (const fim of ["2025-03-01", "2025-06-30"]) {
      const r = validateStep(
        step.questions,
        { ...base, data_inicio: "2025-03-01", data_termino: fim },
        {},
        TODAY,
      );
      expect(r.valid).toBe(true);
    }
  });

  it("corrigir o início revalida o término (reconciliação do caso)", () => {
    const questions = step.questions;
    const saved = {
      ...base,
      ainda_trabalha: false,
      data_inicio: "2020-01-01",
      data_termino: "2021-01-01",
      registro_formal: "sim",
      empregador: "E",
      funcao: "F",
    };
    expect(reconcileAnswers(questions, saved, TODAY).invalid).toEqual({});
    const changed = { ...saved, data_inicio: "2022-01-01" };
    const r = reconcileAnswers(questions, changed, TODAY);
    expect(Object.keys(r.invalid)).toEqual(["data_termino"]);
    expect(r.answers.data_termino).toBeUndefined();
    expect(firstIncompleteStep([step], changed, TODAY)).toBe(0);
  });
});

describe("respostas condicionais", () => {
  const q = (key: string, extra: Partial<TriageQuestion> = {}, order = 1): TriageQuestion =>
    ({
      id: `00000000-0000-4000-8000-00000000000${order}`,
      legalAreaId: "00000000-0000-4000-8000-000000000009",
      key,
      label: key,
      type: "boolean",
      required: true,
      sortOrder: order,
      active: true,
      section: order < 3 ? "S1" : "S2",
      ...extra,
    }) as TriageQuestion;
  // A → B (se A = sim) → C (se B = sim), em etapas diferentes.
  const chain = [
    q("a", {}, 1),
    q("b", { showIf: { questionKey: "a", equals: true } }, 2),
    q("c", { showIf: { questionKey: "b", equals: true } }, 3),
  ];

  it("oculta em cadeia e aponta o que deve ser apagado", () => {
    const r = reconcileAnswers(chain, { a: false, b: true, c: true }, TODAY);
    expect(r.hidden.sort()).toEqual(["b", "c"]);
    expect(r.answers).toEqual({ a: false });
  });

  it("progresso só conta respostas válidas e visíveis", () => {
    expect(completion(chain, { a: true, b: true, c: true }, TODAY)).toBe(100);
    // C segue oculta (B sem resposta): 2 obrigatórias visíveis, 1 respondida.
    expect(completion(chain, { a: true }, TODAY)).toBe(50);
    expect(firstIncompleteStep(buildSteps(chain), { a: true }, TODAY)).toBe(0);
  });

  it("detecta ciclos de dependência", () => {
    const cyclic = [
      q("x", { showIf: { questionKey: "y", equals: true } }, 1),
      q("y", { showIf: { questionKey: "x", equals: true } }, 2),
    ];
    expect(findConditionalCycle(cyclic)).toEqual(["x", "y", "x"]);
    expect(findConditionalCycle(chain)).toBeNull();
  });

  it.each(LEGAL_AREAS.map((a) => [a.slug, a.id] as const))(
    "configuração de %s não tem ciclos nem referências quebradas",
    (_slug, areaId) => {
      const qs = ALL_TRIAGE_QUESTIONS.filter((x) => x.legalAreaId === areaId);
      expect(findConditionalCycle(qs)).toBeNull();
      const keys = new Set(qs.map((x) => x.key));
      for (const x of qs) {
        if (x.showIf) expect(keys.has(x.showIf.questionKey), x.key).toBe(true);
        if (x.constraints?.notBefore)
          expect(keys.has(x.constraints.notBefore.key), x.key).toBe(true);
      }
    },
  );
});
