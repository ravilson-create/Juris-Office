import { expect, test, type Page } from "@playwright/test";
import { buildSteps, validateStep, type AnswerMap } from "@/domain/triage/engine";
import type { RawFormValues, TriageQuestion } from "@/domain/triage/schema";
import { DOCUMENT_CHECKLISTS } from "@/lib/mocks/document-checklists";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { ALL_TRIAGE_QUESTIONS } from "@/lib/mocks/triage";
import { AREA_PLANS, type AreaPlan } from "./areas-plan";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const labelRe = (q: TriageQuestion) => new RegExp(`^${esc(q.label)}`);
const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

async function fill(page: Page, q: TriageQuestion, value: string | string[]) {
  if (q.type === "boolean" || q.type === "single_choice" || q.type === "multiple_choice") {
    const group = page.getByRole("group", { name: labelRe(q) });
    for (const v of Array.isArray(value) ? value : [value]) {
      const label =
        q.type === "boolean"
          ? v === "sim"
            ? "Sim"
            : "Não"
          : q.options!.find((o) => o.value === v)!.label;
      await group.getByLabel(label, { exact: true }).check();
    }
    return;
  }
  await page.getByLabel(labelRe(q)).fill(String(value));
}

async function identify(page: Page) {
  await expect(h1(page)).toHaveText("Seus dados de contato");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible(); // campos obrigatórios
  await page.getByLabel("Nome completo").fill("Pessoa de Teste Fictícia");
  await page.getByLabel("E-mail").fill("teste@example.com");
  await page.getByLabel("Telefone com DDD").fill("11912345678");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("Campinas");
  await page.getByLabel("Estado (UF)").selectOption("SP");
  await page.getByLabel(/Estou ciente/).check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
}

async function answerTriage(page: Page, plan: AreaPlan, questions: TriageQuestion[]) {
  const answers = { ...plan.answers };
  let saved: AnswerMap = {};
  for (const step of buildSteps(questions)) {
    await expect(h1(page)).toHaveText(step.title);
    const raw: RawFormValues = {};
    const cond = plan.conditional;
    for (const q of step.questions) {
      if (validateStep(step.questions, raw, saved).hiddenKeys.includes(q.key)) continue;
      const value = answers[q.key];
      if (value === undefined) continue;
      if (cond && cond.trigger === q.key) {
        const revealed = questions.find((x) => x.key === cond.reveals)!;
        await fill(page, q, cond.otherwise);
        await expect(page.getByText(revealed.label, { exact: false })).toHaveCount(0);
        await fill(page, q, cond.when);
        await expect(page.getByText(revealed.label, { exact: false }).first()).toBeVisible();
      } else {
        const useInvalid = q.key === plan.invalid.key;
        await fill(page, q, useInvalid ? plan.invalid.value : value);
      }
      raw[q.key] = value;
    }

    const submit = page.getByRole("button", { name: /^Salvar e (continuar|ir para o relato)$/ });
    if (step.questions.some((q) => q.key === plan.invalid.key)) {
      await submit.click();
      const error = page.getByText(plan.invalid.message).first();
      await expect(error).toBeVisible();
      await expect(h1(page)).toHaveText(step.title); // não avança
      const fixOther = plan.invalid.fixOther;
      if (fixOther) {
        // Corrigir o campo relacionado revalida o campo com erro.
        await fill(
          page,
          questions.find((x) => x.key === fixOther.key)!,
          fixOther.value,
        );
        await expect(page.getByText(plan.invalid.message)).toHaveCount(0);
        raw[fixOther.key] = fixOther.value;
        raw[plan.invalid.key] = plan.invalid.value;
        answers[fixOther.key] = fixOther.value;
      } else {
        const q = questions.find((x) => x.key === plan.invalid.key)!;
        await fill(page, q, answers[q.key] as string);
      }
    }
    await submit.click();
    const result = validateStep(step.questions, raw, saved);
    expect(result.errors, `etapa ${step.title}`).toEqual({});
    saved = { ...saved, ...result.values };
  }
}

for (const plan of AREA_PLANS) {
  test(`${plan.name}: jornada completa, validações, finalização, bloqueio e retomada`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const area = LEGAL_AREAS.find((a) => a.slug === plan.slug)!;
    const questions = ALL_TRIAGE_QUESTIONS.filter((q) => q.legalAreaId === area.id);
    const firstDoc = DOCUMENT_CHECKLISTS.find((d) => d.legalAreaId === area.id)!;

    // 1. Criação e identificação
    await page.goto("/atendimento");
    await page.getByRole("button", { name: `Escolher ${plan.name}` }).click();
    const protocol = (await page
      .getByText(/^JO-\d{8}-[A-Z0-9]{28}$/)
      .first()
      .textContent())!;
    await identify(page);

    // 2–3. Perguntas, condicionais e validações
    await answerTriage(page, plan, questions);

    // 4. Relato
    await expect(h1(page)).toHaveText("Conte o que aconteceu");
    await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();
    await expect(page.getByText(/mínimo de 30 caracteres/).first()).toBeVisible();
    await page
      .getByLabel("O que aconteceu?")
      .fill(`Relato fictício de teste da área ${plan.name}, com detalhes suficientes.`);
    await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();

    // 5. Documentos simulados
    await expect(h1(page)).toHaveText("Documentos do caso");
    await page.getByLabel(new RegExp(`Adicionar arquivo em ${esc(firstDoc.label)}`)).setInputFiles({
      name: "documento-ficticio.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 teste"),
    });
    await expect(
      page.getByRole("button", { name: "Remover documento-ficticio.pdf" }),
    ).toBeVisible();
    await expect(page.getByText("Registrado (1)")).toBeVisible();
    await expect(page.getByText(/arquivo não recebido/).first()).toBeVisible();
    await page.getByLabel(/Adicionar arquivo em Outros documentos/).setInputFiles({
      name: "programa.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("MZ"),
    });
    await expect(page.getByRole("alert").filter({ hasText: "programa.exe" })).toContainText(
      "não aceito",
    );
    await page.getByRole("button", { name: "Continuar para a revisão" }).click();

    // 6. Revisão e correção
    await expect(h1(page)).toHaveText("Revise antes de finalizar");
    const preview = page.getByRole("article", { name: "Prévia do dossiê" });
    const fix = questions.find((q) => q.key === plan.correction.key)!;
    await page.getByRole("link", { name: `Corrigir ${fix.section}` }).click();
    await expect(h1(page)).toHaveText(fix.section);
    await fill(page, fix, plan.correction.value);
    await page.getByRole("button", { name: "Salvar e voltar à revisão" }).click();
    await expect(h1(page)).toHaveText("Revise antes de finalizar");
    await expect(preview.getByText(plan.correction.shown).first()).toBeVisible();

    // 7. Finalização
    await page.getByRole("button", { name: "Finalizar atendimento de teste" }).click();
    await expect(h1(page)).toHaveText("Atendimento de teste finalizado");
    await expect(page.getByTestId("protocolo-final")).toHaveText(protocol);
    await expect(page.getByText(/O atendimento fica disponível à equipe/)).toBeVisible();

    // 8. Dossiê
    await page.getByRole("link", { name: "Ver o dossiê gerado" }).click();
    const dossier = page.getByRole("article", { name: "Dossiê jurídico preliminar" });
    await expect(dossier.getByRole("heading", { level: 2 })).toHaveCount(11);
    await expect(dossier.getByText(protocol)).toBeVisible();
    await expect(dossier.getByText("Gerado para demonstração")).toBeVisible();
    await expect(dossier.getByText(plan.correction.shown).first()).toBeVisible();
    await expect(dossier.getByText(plan.dossierText).first()).toBeVisible();

    // 9. Bloqueio de edição após a finalização
    const base = new URL(page.url()).pathname.replace(/\/dossie$/, "");
    for (const path of ["identificacao", "triagem", "relato", "documentos", "revisar"]) {
      await page.goto(`${base}/${path}`);
      await expect(h1(page)).toHaveText("Atendimento de teste finalizado");
    }

    // 10. Retomada pela lista de atendimentos
    await page.getByRole("link", { name: "Meus atendimentos" }).first().click();
    await expect(h1(page)).toHaveText("Meus atendimentos");
    const item = page.getByRole("listitem").filter({ hasText: protocol });
    await expect(item).toContainText(plan.name);
    await expect(item).toContainText("Recebido · aguardando análise");
    await item.getByRole("link", { name: /Abrir dossiê/ }).click();
    await expect(page.getByRole("article", { name: "Dossiê jurídico preliminar" })).toBeVisible();
  });
}
