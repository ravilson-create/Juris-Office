import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Política de conteúdo: só recursos do próprio site. O Next.js injeta scripts e estilos
 * inline na hidratação, por isso 'unsafe-inline' (trocar por nonce quando houver middleware).
 * Em desenvolvimento o React precisa de 'unsafe-eval'.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Envia só a origem para outros sites: o endereço do atendimento não vaza por links externos.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Imagem Docker: NEXT_OUTPUT=standalone gera um servidor Node mínimo. Sem a variável, o
  // `next start` normal continua funcionando (desenvolvimento e testes).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Páginas com dados pessoais: fora de buscadores e de caches compartilhados.
        source: "/atendimento/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
