import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // No CI, uma repetição: o teste que só passa na segunda tentativa aparece como "flaky"
  // no relatório (não é escondido) e o trace da falha fica salvo. Localmente, sem repetição.
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    trace: "retain-on-failure",
    // Permite usar um Chromium já instalado (ex.: ambientes sem acesso ao CDN do Playwright).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Os E2E rodam sem banco: memória do processo, autorizada explicitamente.
    command: `ALLOW_MEMORY_STORE=1 npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
