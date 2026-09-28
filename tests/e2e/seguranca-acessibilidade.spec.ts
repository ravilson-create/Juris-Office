import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

async function expectNoA11yViolations(page: Page, name: string) {
  // Após navegação no cliente o Next atualiza o <title> logo depois do conteúdo;
  // espera o título para não auditar a página no meio da troca.
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

async function identify(page: Page) {
  await page.getByLabel("Nome completo").fill("Maria de Teste");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("Telefone com DDD").fill("11912345678");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("Campinas");
  await page.getByLabel("Estado (UF)").selectOption("SP");
  await page.getByLabel(/Estou ciente/).check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
}

async function startCase(page: Page) {
  await page.goto("/atendimento");
  await page.getByRole("button", { name: "Escolher Consumidor" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Seus dados de contato");
}

test("cabeçalhos de segurança e não indexação", async ({ request }) => {
  const home = await request.get("/");
  const h = home.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();

  const area = await request.get("/atendimento");
  expect(area.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(area.headers()["cache-control"]).toContain("no-store");
  // Site de testes: por padrão, nenhum buscador indexa nada (INDEXAR_SITE só existe fora dos testes).
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \/(\s|$)/);
  expect(robots).not.toContain("Allow: /");
  expect(h["x-robots-tag"] ?? "").toBe(""); // a home usa <meta robots>, não o cabeçalho
  expect(await home.text()).toContain('name="robots" content="noindex, nofollow"');
});

test("atendimento só abre no navegador que o criou", async ({ page, browser }) => {
  await startCase(page);
  const cookie = (await page.context().cookies()).find((c) => c.name === "jo_sessao");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const caseUrl = page.url();

  const other = await browser.newContext();
  const intruder = await other.newPage();
  await intruder.goto(caseUrl);
  await expect(intruder.getByRole("heading", { level: 1 })).toHaveText(
    "Página ou atendimento não encontrado",
  );
  await other.close();

  // O dono continua acessando normalmente.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Seus dados de contato");
});

test("queda de conexão mostra aviso e preserva o que foi digitado", async ({ page }) => {
  await startCase(page);
  await page.route("**/atendimento/**", (route) =>
    route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
  );
  await page.getByLabel("Nome completo").fill("Maria de Teste");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("Telefone com DDD").fill("11912345678");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("Campinas");
  await page.getByLabel("Estado (UF)").selectOption("SP");
  await page.getByLabel(/Estou ciente/).check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByText(/Não foi possível falar com o servidor/)).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toHaveValue("Maria de Teste");
  await expect(page.getByRole("button", { name: "Salvar e continuar" })).toBeEnabled();
});

test("teclado: link para pular ao conteúdo e envio de arquivo acessível", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
});

test("sem violações de acessibilidade em toda a jornada", async ({ page }) => {
  test.setTimeout(90_000);
  for (const path of ["/", "/como-funciona", "/privacidade", "/atendimento"]) {
    await page.goto(path);
    await expectNoA11yViolations(page, path);
  }

  await startCase(page);
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expectNoA11yViolations(page, "identificação com erros");
  await identify(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O produto ou serviço");
  await expect(page).toHaveTitle(/Triagem/);
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByText("Responda esta pergunta para continuar.").first()).toBeVisible();
  await expectNoA11yViolations(page, "triagem com erros");
  await page.getByLabel(/Qual produto ou serviço/).fill("Plano de internet");
  await page.getByLabel(/Quem é o fornecedor/).fill("Operadora Exemplo");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveTitle(/Triagem — parte 2/);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByLabel("Sim, totalmente").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
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
  await page
    .getByRole("group", { name: /tentou resolver/ })
    .getByLabel("Não")
    .check();
  await page.getByRole("button", { name: "Salvar e ir para o relato" }).click();

  await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();
  await expect(page.getByText(/mínimo de 30 caracteres/).first()).toBeVisible();
  await expectNoA11yViolations(page, "relato com erro");
  await page
    .getByLabel("O que aconteceu?")
    .fill("Em maio a operadora cobrou duas vezes a mesma fatura e não devolveu o valor.");
  await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();

  const upload = page.getByLabel(/Adicionar arquivo em Nota fiscal/);
  await upload.focus();
  await expect(upload).toBeFocused();
  await upload.setInputFiles({
    name: "nf.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF"),
  });
  await expect(page.getByRole("button", { name: "Remover nf.pdf" })).toBeVisible();
  await page
    .getByLabel(/Adicionar arquivo em Contrato/)
    .setInputFiles({ name: "x.exe", mimeType: "", buffer: Buffer.from("x") });
  await expect(page.getByRole("alert").filter({ hasText: "x.exe" })).toBeVisible();
  await expectNoA11yViolations(page, "documentos com erro");

  await page.getByRole("button", { name: "Continuar para a revisão" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Revise antes de finalizar");
  await expectNoA11yViolations(page, "revisão");
  await page.getByRole("button", { name: "Finalizar atendimento de teste" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atendimento de teste finalizado",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expectNoA11yViolations(page, "protocolo");
  await page.getByRole("link", { name: "Ver o dossiê gerado" }).click();
  await expect(page.getByRole("article", { name: "Dossiê jurídico preliminar" })).toBeVisible();
  await expectNoA11yViolations(page, "dossiê");
});
