import { expect, test } from "@playwright/test";

test("jornada de Consumidor: área → identificação → triagem → relato → documentos → revisão → protocolo → dossiê", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Advocacia, tecnologia e atendimento em um só lugar.");
  await page.getByRole("main").getByRole("link", { name: "Iniciar atendimento" }).click();

  await expect(page).toHaveURL(/\/atendimento$/);
  await expect(page.getByRole("button", { name: /^Escolher/ })).toHaveCount(5);
  await page.getByRole("button", { name: "Escolher Consumidor" }).click();

  // Identificação: validação e envio
  await expect(page).toHaveURL(/\/identificacao$/);
  const protocol = await page.getByText(/^JO-\d{8}-/).textContent();
  expect(protocol).toMatch(/^JO-\d{8}-[A-Z2-9]{6}$/);

  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("alert").first()).toContainText("Revise os campos");
  await expect(page.getByLabel("Nome completo")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Nome completo").fill("Maria de Teste");
  await page.getByLabel("CPF").fill("11144477735");
  await page.getByLabel("E-mail").fill("maria@example.com");
  await page.getByLabel("Telefone com DDD").fill("(11) 91234-5678");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("Campinas");
  await page.getByLabel("Estado (UF)").selectOption("SP");
  await page.getByLabel(/Estou ciente/).check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();

  // Parte 1
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O produto ou serviço");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByText("Responda esta pergunta para continuar.").first()).toBeVisible();
  await page.getByLabel(/Qual produto ou serviço/).fill("Plano de internet");
  await page.getByLabel(/Quem é o fornecedor/).fill("Operadora Exemplo");
  await page.getByLabel(/Quando ocorreu/).fill("2026-05-10");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();

  // Parte 2
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Valores e pagamento");
  await page.getByLabel(/Qual o valor envolvido/).fill("119,90");
  await page.getByLabel("Sim, totalmente").check();
  await page.getByLabel("Cobrança que considero indevida").check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();

  // Parte 3
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O problema");
  await page.getByLabel(/Qual foi o problema/).fill("A fatura veio com cobrança em dobro.");
  await page
    .getByRole("group", { name: /ainda está acontecendo/ })
    .getByLabel("Sim")
    .check();
  await page
    .getByRole("group", { name: /contrato, nota fiscal/ })
    .getByLabel("Sim")
    .check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();

  // Parte 4 — pergunta condicional
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tentativas de solução");
  await expect(page.getByLabel(/número de protocolo/)).toHaveCount(0);
  await page
    .getByRole("group", { name: /tentou resolver/ })
    .getByLabel("Sim")
    .check();
  await expect(page.getByLabel(/número de protocolo/)).toBeVisible();
  await page.getByLabel(/número de protocolo/).fill("2026000123");
  await page.getByLabel("Respondeu, mas não resolveu").check();
  await page.getByRole("button", { name: "Salvar e ir para o relato" }).click();

  // Relato
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conte o que aconteceu");
  await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();
  await expect(page.getByText(/mínimo de 30 caracteres/).first()).toBeVisible();
  await page
    .getByLabel("O que aconteceu?")
    .fill("Em maio a operadora cobrou duas vezes a mesma fatura e não devolveu o valor.");
  await page.getByRole("button", { name: "Salvar e ir para documentos" }).click();

  // Documentos (upload simulado)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentos do caso");
  await page.getByLabel(/Adicionar arquivo em Nota fiscal ou recibo/).setInputFiles({
    name: "nota-fiscal.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 teste"),
  });
  await expect(page.getByRole("button", { name: "Remover nota-fiscal.pdf" })).toBeVisible();
  await expect(page.getByText("Registrado (1)")).toBeVisible();
  await page.getByLabel(/Adicionar outro arquivo em Nota fiscal ou recibo/).setInputFiles({
    name: "programa.exe",
    mimeType: "application/x-msdownload",
    buffer: Buffer.from("MZ"),
  });
  await expect(page.getByRole("alert").filter({ hasText: "programa.exe" })).toContainText(
    "não aceito",
  );
  await page.getByRole("button", { name: "Continuar para a revisão" }).click();

  // Revisão
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Revise antes de finalizar");
  const preview = page.getByRole("article", { name: "Prévia do dossiê" });
  await expect(preview.getByText("R$ 119,90")).toBeVisible();
  await expect(preview.getByText("10/05/2026")).toBeVisible();
  await expect(preview.getByText("2026000123")).toBeVisible();
  await expect(preview.getByText("nota-fiscal.pdf")).toBeVisible();
  await expect(preview.getByText(/Recomendados não registrados/)).toContainText("Contrato");
  await expect(preview.getByText(protocol!)).toBeVisible();

  // Corrigir a partir da revisão volta direto para a revisão, com respostas preservadas
  await page.getByRole("link", { name: "Corrigir Valores e pagamento" }).click();
  await expect(page.getByLabel(/Qual o valor envolvido/)).toHaveValue("119,90");
  await expect(page.getByLabel("Sim, totalmente")).toBeChecked();
  await page.getByLabel(/Qual o valor envolvido/).fill("239,80");
  await page.getByRole("button", { name: "Salvar e voltar à revisão" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Revise antes de finalizar");
  await expect(preview.getByText("R$ 239,80")).toBeVisible();

  await page.getByRole("link", { name: "Corrigir Relato" }).click();
  await page
    .getByLabel("O que aconteceu?")
    .fill("Em maio a operadora cobrou duas vezes a mesma fatura. Guardei os protocolos.");
  await page.getByRole("button", { name: "Salvar e voltar à revisão" }).click();
  await expect(preview.getByText(/Guardei os protocolos/)).toBeVisible();

  // Envio → protocolo
  await page.getByRole("button", { name: "Finalizar atendimento" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atendimento finalizado",
  );
  await expect(page.getByTestId("protocolo-final")).toHaveText(protocol!);

  // Dossiê: 11 seções, dados consolidados
  await page.getByRole("link", { name: "Ver o dossiê gerado" }).click();
  const dossier = page.getByRole("article", { name: "Dossiê jurídico preliminar" });
  await expect(dossier.getByRole("heading", { level: 2 })).toHaveCount(11);
  await expect(dossier.getByText("Operadora Exemplo — Fornecedor")).toBeVisible();
  await expect(dossier.getByText("Compra ou contratação", { exact: true })).toBeVisible();
  await expect(dossier.getByText(/R\$\s239,80/).first()).toBeVisible();
  await expect(dossier.getByText("nota-fiscal.pdf")).toBeVisible();
  await expect(dossier.getByText(/Documento recomendado não registrado: Contrato/)).toBeVisible();
  await expect(dossier.getByText(/não constitui parecer jurídico/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimir ou salvar em PDF" })).toBeVisible();

  // Depois do envio, telas de edição levam ao protocolo
  const caseUrl = page.url().replace(/\/dossie$/, "");
  await page.goto(`${caseUrl}/triagem`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atendimento finalizado",
  );
  await page.goto(`${caseUrl}/revisar`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atendimento finalizado",
  );
});

test("atendimento inexistente mostra página de não encontrado", async ({ page }) => {
  await page.goto("/atendimento/00000000-0000-4000-8000-000000000000/triagem");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/não encontrado/);
});

test("a triagem muda conforme a área escolhida (Família)", async ({ page }) => {
  await page.goto("/atendimento");
  await page.getByRole("button", { name: "Escolher Família" }).click();
  await page.getByLabel("Nome completo").fill("Ana de Teste");
  await page.getByLabel("CPF").fill("11144477735");
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page.getByLabel("Telefone com DDD").fill("21987654321");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("Niterói");
  await page.getByLabel("Estado (UF)").selectOption("RJ");
  await page.getByLabel(/Estou ciente/).check();
  await page.getByRole("button", { name: "Salvar e continuar" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O assunto");
  await expect(page.getByText("Parte 1 de 3")).toBeVisible();
  await expect(page.getByLabel(/Quantos filhos/)).toHaveCount(0);
  await page
    .getByRole("group", { name: /filhos menores/ })
    .getByLabel("Sim")
    .check();
  await expect(page.getByLabel(/Quantos filhos/)).toBeVisible();
});
