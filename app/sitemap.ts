import type { MetadataRoute } from "next";

// Sitemap somente das páginas institucionais abertas ao público.
// Não divulga protocolos, casos, dados pessoais, nem rotas do portal privado.
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.INDEXAR_SITE !== "1") return [];

  const base = "https://juris-office-ia.vercel.app";
  return [
    { url: base + "/", changeFrequency: "weekly", priority: 1 },
    { url: base + "/advogado", changeFrequency: "monthly", priority: 0.8 },
    { url: base + "/como-funciona", changeFrequency: "monthly", priority: 0.7 },
    { url: base + "/privacidade", changeFrequency: "yearly", priority: 0.3 },
  ];
}
