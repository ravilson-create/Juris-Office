import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

export const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** Audita a página atual; espera o título para não auditar no meio da navegação. */
export async function expectNoA11yViolations(page: Page, name: string) {
  await expect(page).toHaveTitle(/\S/);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = violations.map(
    (v) =>
      `${v.id}: ${v.help} → ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(" | ")}`,
  );
  expect(summary, `violações em ${name}`).toEqual([]);
}

/** Sem barra de rolagem horizontal na página atual. */
export async function expectNoHorizontalScroll(page: Page, name: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `rolagem horizontal em ${name}`).toBeLessThanOrEqual(clientWidth);
}

export async function startConsumidor(page: Page) {
  await page.goto("/atendimento");
  await page.getByRole("button", { name: "Escolher Consumidor" }).click();
  await expect(h1(page)).toHaveText("Seus dados de contato");
}

export async function fillIdentification(page: Page) {
  await page.getByLabel("Nome completo").fill("Pessoa de Teste Fictícia");
  await page.getByLabel("CPF").fill("11144477735");
  await page.getByLabel("E-mail").fill("teste@example.com");
  await page.getByLabel("Telefone com DDD").fill("11912345678");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("Campinas");
  await page.getByLabel("Estado (UF)").selectOption("SP");
  await page.getByLabel(/Estou ciente/).check();
}

/** Cria um atendimento de Consumidor e conclui a identificação e a primeira parte da triagem. */
export async function consumidorAtStepTwo(page: Page) {
  await startConsumidor(page);
  await fillIdentification(page);
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(h1(page)).toHaveText("O produto ou serviço");
  await page.getByLabel(/Qual produto ou serviço/).fill("Plano de internet");
  await page.getByLabel(/Quem é o fornecedor/).fill("Operadora Exemplo");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(h1(page)).toHaveText("Valores e pagamento");
}

/** Leva um atendimento de Consumidor até a tela de relato (triagem completa). */
export async function consumidorAtNarrative(page: Page) {
  await consumidorAtStepTwo(page);
  await page.getByLabel("Sim, totalmente").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(h1(page)).toHaveText("O problema");
  await page.getByLabel(/Qual foi o problema/).fill("Cobrança em dobro.");
  await page
    .getByRole("group", { name: /ainda está acontecendo/ })
    .getByLabel("Sim")
    .check();
  await page
    .getByRole("group", { name: /contrato, nota fiscal/ })
    .getByLabel("Sim")
    .check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(h1(page)).toHaveText("Tentativas de solução");
  await page
    .getByRole("group", { name: /tentou resolver/ })
    .getByLabel("Não")
    .check();
  await page.getByRole("button", { name: "Salvar e ir para o relato" }).click();
  await expect(h1(page)).toHaveText("Conte o que aconteceu");
}

/** Digita como uma pessoa (eventos confiáveis), sem colar o texto de uma vez. */
export async function typeInto(page: Page, label: string | RegExp, text: string) {
  const field = page.getByLabel(label);
  await field.click();
  await page.keyboard.type(text, { delay: 5 });
}
