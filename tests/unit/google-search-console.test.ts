import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

const googleVerificationPath = new URL("../../public/google8de219c6908bafb6.html", import.meta.url);

afterEach(() => vi.unstubAllEnvs());

describe("Google Search Console e indexação segura", () => {
  it("publica o arquivo HTML exatamente como recebido do Google", () => {
    expect(readFileSync(googleVerificationPath, "utf8")).toBe(
      "google-site-verification: google8de219c6908bafb6.html",
    );
  });

  it("bloqueia a indexação por padrão sem autorização de produção", () => {
    vi.stubEnv("INDEXAR_SITE", "");
    expect(JSON.stringify(robots())).toContain('"disallow":"/"');
    expect(sitemap()).toEqual([]);
  });

  it("permite apenas as páginas públicas quando a indexação é ativada", () => {
    vi.stubEnv("INDEXAR_SITE", "1");
    const regras = JSON.stringify(robots());
    for (const pagina of ["/$", "/advogado$", "/como-funciona$", "/privacidade$"]) {
      expect(regras).toContain(pagina);
    }
    expect(regras).toContain('"disallow":"/"');
    expect(regras).toContain("/google8de219c6908bafb6.html");

    const urls = sitemap().map((item) => item.url);
    expect(urls).toEqual([
      "https://juris-office-ia.vercel.app/",
      "https://juris-office-ia.vercel.app/advogado",
      "https://juris-office-ia.vercel.app/como-funciona",
      "https://juris-office-ia.vercel.app/privacidade",
    ]);
    expect(urls.some((url) => url.includes("/atendimento"))).toBe(false);
  });
});
