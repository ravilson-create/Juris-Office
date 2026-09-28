import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// A Content-Security-Policy tem nonce por requisição e é montada no middleware (middleware.ts),
// não aqui: headers() só produz um valor estático, e o nonce precisa mudar a cada requisição.
const securityHeaders = [
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
