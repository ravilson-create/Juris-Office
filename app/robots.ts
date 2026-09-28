import type { MetadataRoute } from "next";

/**
 * Site de testes: fora de buscadores por padrão. Só indexa com INDEXAR_SITE=1
 * (e mesmo assim as páginas de atendimento nunca são indexadas).
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.INDEXAR_SITE !== "1") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/atendimento", "/api"] } };
}
