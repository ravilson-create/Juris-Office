import type { MetadataRoute } from "next";

// A indexação é habilitada apenas em produção com INDEXAR_SITE=1.
// Páginas públicas de apresentação podem aparecer na Busca Google;
// solicitações, dados de cidadãos, escritório e áreas administrativas
// permanecem excluídos mesmo quando a indexação está ativada.
export default function robots(): MetadataRoute.Robots {
  if (process.env.INDEXAR_SITE !== "1") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      // Acesso exclusivo a páginas institucionais conhecidas.
      // O $ impede que /advogado libere /advogado/casos ou outras rotas internas.
      allow: [
        "/$", "/advogado$", "/como-funciona$", "/privacidade$",
        "/google8de219c6908bafb6.html",
        "/_next/", "/brand/", "/icon.png", "/apple-icon.png", "/favicon.ico",
      ],
      disallow: "/",
    },
    sitemap: "https://juris-office-ia.vercel.app/sitemap.xml",
  };
}
