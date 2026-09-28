import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const common = { resolve: { tsconfigPaths: true }, plugins: [react()] } as const;

// Opcional: PostgreSQL de verdade (ex.: local ou uma branch de teste do Neon) via TEST_DATABASE_URL.
const realPostgres = process.env.TEST_DATABASE_URL
  ? [
      {
        ...common,
        test: {
          name: "postgres-real",
          environment: "node",
          include: ["tests/integration/**/*.test.ts", "tests/postgres/**/*.test.ts"],
          env: { TEST_BACKEND: "pgreal", TEST_DATABASE_URL: process.env.TEST_DATABASE_URL },
          testTimeout: 60_000,
          fileParallelism: false, // arquivos usam as mesmas tabelas
        },
      },
    ]
  : [];

export default defineConfig({
  test: {
    css: false,
    projects: [
      {
        ...common,
        test: {
          name: "memoria",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
        },
      },
      {
        // As mesmas suítes de integração, contra PostgreSQL (PGlite): prova que o Neon
        // se comporta como o mock nas regras de negócio e nas garantias de concorrência.
        ...common,
        test: {
          name: "postgres",
          environment: "node",
          include: ["tests/integration/**/*.test.ts", "tests/postgres/**/*.test.ts"],
          env: { TEST_BACKEND: "pg" },
          testTimeout: 30_000,
        },
      },
      ...realPostgres,
    ],
  },
});
