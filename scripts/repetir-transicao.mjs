/**
 * Repete N vezes a passagem identificação → triagem e conta quantas vezes a tela não troca.
 * Usado na investigação da intermitência (CHANGELOG 4.1-I).
 * Uso: U=http://localhost:3000 N=50 PROFILE="Pixel 7" node scripts/repetir-transicao.mjs
 * (PROFILE=desktop para computador; PLAYWRIGHT_CHROMIUM_PATH opcional.)
 */
import { chromium, devices } from "@playwright/test";
const U = process.env.U,
  N = Number(process.env.N ?? 60),
  PROFILE = process.env.PROFILE ?? "Pixel 7";
const b = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
let stalls = 0,
  ok = 0;
const times = [];
for (let i = 0; i < N; i++) {
  const ctx = await b.newContext({
    ...(PROFILE === "desktop" ? { viewport: { width: 1280, height: 720 } } : devices[PROFILE]),
  });
  const p = await ctx.newPage();
  await p.goto(U + "/atendimento");
  await p.getByRole("button", { name: "Escolher Consumidor" }).click();
  await p.getByRole("heading", { level: 1, name: "Seus dados de contato" }).waitFor();
  await p.getByLabel("Nome completo").fill("Pessoa de Teste Fictícia");
  await p.getByLabel("E-mail").fill("teste@example.com");
  await p.getByLabel("Telefone com DDD").fill("11912345678");
  await p.getByRole("textbox", { name: "Cidade", exact: true }).fill("Campinas");
  await p.getByLabel("Estado (UF)").selectOption("SP");
  await p.getByLabel(/Estou ciente/).check();
  const t0 = Date.now();
  await p.getByRole("button", { name: "Salvar e continuar" }).click();
  try {
    await p
      .getByRole("heading", { level: 1, name: "O produto ou serviço" })
      .waitFor({ timeout: 6000 });
    ok++;
    times.push(Date.now() - t0);
  } catch {
    stalls++;
    // Recupera? aguarda mais um pouco e registra se a tela trocou sozinha.
    const later = await p
      .getByRole("heading", { level: 1, name: "O produto ou serviço" })
      .waitFor({ timeout: 6000 })
      .then(
        () => "trocou depois",
        () => "continua parada",
      );
    console.log(`iteração ${i}: travou (${later})`);
  }
  await ctx.close();
}
times.sort((a, b) => a - b);
console.log(
  `${PROFILE}: ok=${ok} travadas=${stalls}/${N}; mediana=${times[Math.floor(times.length / 2)]}ms; máx=${times.at(-1)}ms`,
);
await b.close();
