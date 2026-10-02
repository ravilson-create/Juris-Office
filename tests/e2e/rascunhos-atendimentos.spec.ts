import { expect, test } from "@playwright/test";
import {
  consumidorAtNarrative,
  consumidorAtStepTwo,
  expectNoA11yViolations,
  expectNoHorizontalScroll,
  fillIdentification,
  h1,
  startConsumidor,
  typeInto,
} from "./helpers";

const NARRATIVE_TEXT = "Rascunho do relato: a operadora cobrou duas vezes a mesma fatura.";
const draftState = (page: import("@playwright/test").Page) => page.getByTestId("estado-rascunho");

test.describe("rascunhos", () => {
  test("rascunho é salvo, restaurado ao recarregar e não conclui a etapa", async ({ page }) => {
    await consumidorAtNarrative(page);
    await typeInto(page, "O que aconteceu?", NARRATIVE_TEXT);
    await expect(draftState(page)).toContainText("Rascunho salvo");
    await expect(draftState(page)).toContainText("não conclui esta parte");

    await page.reload();
    await expect(page.getByText("Rascunho restaurado")).toBeVisible();
    await expect(page.getByLabel("O que aconteceu?")).toHaveValue(NARRATIVE_TEXT);

    // Rascunho não é a etapa concluída: "Meus atendimentos" ainda leva ao relato.
    await page.goto("/atendimento/meus");
    const item = page.getByRole("listitem").filter({ hasText: "Consumidor" });
    await expect(item).toContainText("Em preenchimento");
    await item.getByRole("link", { name: /Continuar de onde parou/ }).click();
    await expect(h1(page)).toHaveText("Conte o que aconteceu");
    await expect(page.getByLabel("O que aconteceu?")).toHaveValue(NARRATIVE_TEXT);

    // Ao salvar oficialmente, o rascunho deixa de existir.
    await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();
    await expect(h1(page)).toHaveText("Documentos do caso");
    await page.goBack();
    await expect(page.getByText("Rascunho restaurado")).toHaveCount(0);
    await expect(page.getByLabel("O que aconteceu?")).toHaveValue(NARRATIVE_TEXT);
  });

  test("falha de rede: conteúdo preservado, estado real e nova tentativa", async ({ page }) => {
    await consumidorAtNarrative(page);
    let blocked = true;
    await page.route("**/atendimento/**", (route) =>
      blocked && route.request().method() === "POST"
        ? route.abort("internetdisconnected")
        : route.continue(),
    );
    await typeInto(page, "O que aconteceu?", NARRATIVE_TEXT);
    await expect(draftState(page)).toContainText("Não foi possível salvar o rascunho");
    await expect(draftState(page)).not.toContainText("Rascunho salvo");
    await expect(page.getByLabel("O que aconteceu?")).toHaveValue(NARRATIVE_TEXT);

    blocked = false;
    await page.getByRole("button", { name: "Tentar salvar o rascunho agora" }).click();
    await expect(draftState(page)).toContainText("Rascunho salvo");

    await page.reload();
    await expect(page.getByLabel("O que aconteceu?")).toHaveValue(NARRATIVE_TEXT);
  });

  test("falha ao salvar oficialmente não perde o texto nem some o rascunho", async ({ page }) => {
    await consumidorAtNarrative(page);
    await typeInto(page, "O que aconteceu?", NARRATIVE_TEXT);
    await expect(draftState(page)).toContainText("Rascunho salvo");
    await page.route("**/atendimento/**", (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
    );
    await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();
    await expect(page.getByText(/Não foi possível falar com o servidor/)).toBeVisible();
    await expect(page.getByLabel("O que aconteceu?")).toHaveValue(NARRATIVE_TEXT);
    await expect(h1(page)).toHaveText("Conte o que aconteceu");
  });

  test("avisa antes de sair com alteração não salva", async ({ page }) => {
    await consumidorAtNarrative(page);
    let blocked = true;
    await page.route("**/atendimento/**", (route) =>
      blocked && route.request().method() === "POST"
        ? route.abort("internetdisconnected")
        : route.continue(),
    );
    await typeInto(page, "O que aconteceu?", NARRATIVE_TEXT);
    await expect(draftState(page)).toContainText("Não foi possível salvar");

    const dialog = page.waitForEvent("dialog");
    await page.close({ runBeforeUnload: true });
    const d = await dialog;
    expect(d.type()).toBe("beforeunload");
    await d.dismiss();
    blocked = false;
  });

  test("sem alterações pendentes, sair não mostra aviso", async ({ page }) => {
    await consumidorAtNarrative(page);
    await typeInto(page, "O que aconteceu?", NARRATIVE_TEXT);
    await expect(draftState(page)).toContainText("Rascunho salvo");
    let asked = false;
    page.on("dialog", (d) => {
      asked = true;
      void d.dismiss();
    });
    await page.goto("/atendimento/meus");
    expect(asked).toBe(false);
  });

  test("triagem: rascunho de uma parte incompleta é restaurado, sem marcar a parte como feita", async ({
    page,
  }) => {
    await consumidorAtStepTwo(page);
    await page.getByLabel(/Qual o valor envolvido/).fill("1.234,56");
    await expect(draftState(page)).toContainText("Rascunho salvo");
    await page.reload();
    await expect(page.getByText("Rascunho restaurado")).toBeVisible();
    await expect(page.getByLabel(/Qual o valor envolvido/)).toHaveValue("1.234,56");
    // Falta a resposta obrigatória: não avança.
    await page.getByRole("button", { name: "Salvar e continuar" }).click();
    await expect(h1(page)).toHaveText("Valores e pagamento");
    await expect(page.getByText("Responda esta pergunta para continuar.")).toBeVisible();
  });

  test("identificação: rascunho preserva o que foi digitado e não conta como concluída", async ({
    page,
  }) => {
    await startConsumidor(page);
    await page.getByLabel("Nome completo").fill("Pessoa de Teste Fictícia");
    await expect(draftState(page)).toContainText("Rascunho salvo");
    await page.reload();
    await expect(page.getByLabel("Nome completo")).toHaveValue("Pessoa de Teste Fictícia");
    await page.goto("/atendimento/meus");
    await page
      .getByRole("listitem")
      .filter({ hasText: "Consumidor" })
      .getByRole("link", { name: /Continuar de onde parou/ })
      .click();
    await expect(h1(page)).toHaveText("Seus dados de contato");
  });
});

test.describe("Meus atendimentos", () => {
  test("estado vazio, com aviso sobre cookies", async ({ page }) => {
    await page.goto("/atendimento/meus");
    await expect(h1(page)).toHaveText("Meus atendimentos");
    await expect(
      page.getByRole("heading", { name: "Nenhum atendimento neste navegador" }),
    ).toBeVisible();
    await expect(page.getByText(/limpar os cookies/)).toBeVisible();
    await expectNoA11yViolations(page, "meus atendimentos (vazio)");
    await page.getByRole("link", { name: "Iniciar atendimento" }).first().click();
    await expect(h1(page)).toHaveText("Sobre qual assunto é o seu problema?");
    // Visitar a lista não cria sessão nem atendimento.
    expect((await page.context().cookies()).some((c) => c.name === "jo_sessao")).toBe(false);
  });

  test("lista só os atendimentos desta sessão; protocolo não é credencial", async ({ browser }) => {
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();

    await consumidorAtStepTwo(a);
    const urlA = a.url();
    await a.goto("/atendimento/meus");
    const protocolA = (await a
      .getByText(/^JO-\d{8}-[A-Z0-9]{6}$/)
      .first()
      .textContent())!;
    await expect(a.getByRole("listitem").filter({ hasText: protocolA })).toContainText(
      "Consumidor",
    );

    // Outro navegador: lista vazia, sem sinal do atendimento de A.
    await b.goto("/atendimento/meus");
    await expect(
      b.getByRole("heading", { name: "Nenhum atendimento neste navegador" }),
    ).toBeVisible();
    await expect(b.getByText(protocolA)).toHaveCount(0);
    expect(await b.content()).not.toContain(protocolA);

    // Conhecer o protocolo ou o endereço não dá acesso.
    await b.goto(urlA);
    await expect(h1(b)).toHaveText("Página ou atendimento não encontrado");

    // B cria o seu; cada lista mostra só o próprio.
    await startConsumidor(b);
    await b.goto("/atendimento/meus");
    const protocolB = (await b
      .getByText(/^JO-\d{8}-[A-Z0-9]{6}$/)
      .first()
      .textContent())!;
    expect(protocolB).not.toBe(protocolA);
    await expect(b.getByText(protocolA)).toHaveCount(0);
    await a.goto("/atendimento/meus");
    await expect(a.getByText(protocolB)).toHaveCount(0);
    await expect(
      a.getByRole("list", { name: "Atendimentos deste navegador" }).getByRole("listitem"),
    ).toHaveCount(1);

    await a.context().close();
    await b.context().close();
  });

  test("retoma na primeira etapa pendente, por teclado, e lista rascunho e finalizado", async ({
    page,
  }) => {
    await consumidorAtStepTwo(page); // identificação + parte 1 concluídas
    await page.goto("/atendimento/meus");
    await expect(h1(page)).toHaveText("Meus atendimentos");
    const item = page.getByRole("listitem").filter({ hasText: "Consumidor" });
    await expect(item).toContainText("Em preenchimento (triagem)");
    await expect(item).toContainText(/Atualizado em:/);

    // Teclado: o link de retomada é alcançável por Tab e aciona com Enter.
    const resume = item.getByRole("link", { name: /Continuar de onde parou/ });
    await resume.focus();
    await expect(resume).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(h1(page)).toHaveText("Valores e pagamento"); // parte 2: a primeira pendente
  });

  test("cabeçalho: link 'Meus atendimentos' alcançável por teclado", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("banner").getByRole("link", { name: "Meus atendimentos" });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(h1(page)).toHaveText("Meus atendimentos");
  });
});

test.describe("acessibilidade e layout das telas novas", () => {
  test("sem violações e sem rolagem horizontal (lista, rascunho e estados)", async ({ page }) => {
    await page.goto("/atendimento/meus");
    await expectNoHorizontalScroll(page, "meus atendimentos vazio");

    await consumidorAtNarrative(page);
    await typeInto(page, "O que aconteceu?", NARRATIVE_TEXT);
    await expect(draftState(page)).toContainText("Rascunho salvo");
    await expectNoA11yViolations(page, "relato com rascunho salvo");
    await expectNoHorizontalScroll(page, "relato com rascunho salvo");

    await page.reload();
    await expect(page.getByText("Rascunho restaurado")).toBeVisible();
    await expectNoA11yViolations(page, "relato com rascunho restaurado");

    await page.route("**/atendimento/**", (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
    );
    await typeInto(page, "O que aconteceu?", " Mais texto.");
    await expect(draftState(page)).toContainText("Não foi possível salvar o rascunho");
    await expectNoA11yViolations(page, "relato com falha de rascunho");
    await expectNoHorizontalScroll(page, "relato com falha de rascunho");
    await page.unroute("**/atendimento/**");

    await page.goto("/atendimento/meus");
    await expectNoA11yViolations(page, "meus atendimentos com item");
    await expectNoHorizontalScroll(page, "meus atendimentos com item");
  });

  test("320 px: telas de identificação, lista e protocolo sem rolagem horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await startConsumidor(page);
    await expectNoHorizontalScroll(page, "identificação 320px");
    await fillIdentification(page);
    await expect(draftState(page)).toContainText("Rascunho salvo");
    await expectNoHorizontalScroll(page, "identificação com rascunho 320px");
    await page.goto("/atendimento/meus");
    await expectNoHorizontalScroll(page, "meus atendimentos 320px");
    await page.goto("/");
    await expectNoHorizontalScroll(page, "home 320px");
  });
});
