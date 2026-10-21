import { expect, test } from "@playwright/test";

test("home apresenta funcionalidades profissionais e preços com links para cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Advocacia, tecnologia e atendimento em um só lugar." })).toBeVisible();

  const apresentacao = page.getByRole("region", { name: "O Júris Office IA em menos de um minuto." });
  await expect(apresentacao).toBeVisible();
  const video = apresentacao.locator("video");
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).not.toHaveAttribute("autoplay", /.*/);
  await expect(video.locator("track[kind='captions']")).toHaveAttribute("src", "/apresentacao/juris-office-ia.pt-BR.vtt");
  for (const caminho of ["/apresentacao/juris-office-ia.mp4", "/apresentacao/juris-office-ia-poster.jpg", "/apresentacao/juris-office-ia.pt-BR.vtt"]) {
    expect((await page.request.get(caminho)).ok(), caminho).toBe(true);
  }

  const recursos = page.getByRole("region", { name: "Do primeiro atendimento à gestão do escritório." });
  for (const titulo of [
    "Triagem e dossiês", "Portal do advogado", "Contratos de honorários",
    "Petições e peças processuais", "Inteligência artificial de apoio",
    "Prazos processuais", "Consultas jurídicas", "Financeiro do escritório",
    "Equipe, pessoal e folha",
  ]) await expect(recursos.getByRole("heading", { name: titulo, exact: true })).toBeVisible();
  await expect(recursos).toContainText("DataJud quando configurado");
  await expect(recursos).toContainText("não executam pagamentos");

  const planos = page.getByRole("region", { name: "Um escritório digital com preço acessível." });
  await expect(planos).toContainText("39,90");
  await expect(planos).toContainText("300,00");
  await expect(planos.getByRole("link", { name: /Plano Mensal/ })).toHaveAttribute("href", "/advogado/cadastro?plano=monthly");
  await expect(planos.getByRole("link", { name: /Plano Anual/ })).toHaveAttribute("href", "/advogado/cadastro?plano=yearly");

  await expect(page.getByRole("link", { name: "Iniciar atendimento jurídico" })).toHaveAttribute("href", "/atendimento");
  await expect(page.getByRole("link", { name: "Consultar meu atendimento" })).toHaveAttribute("href", "/atendimento/meus");
});
