import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Manrope } from "next/font/google";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  robots: process.env.INDEXAR_SITE === "1" ? undefined : { index: false, follow: false },
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description:
    "Organize seu caso jurídico com perguntas guiadas e gere um dossiê para o advogado responsável.",
  applicationName: APP_NAME,
};

export const viewport: Viewport = {
  themeColor: "#1456cc",
  width: "device-width",
  initialScale: 1,
};

// A CSP tem nonce por requisição (ver middleware.ts): uma página pré-renderizada em build não tem
// como receber esse nonce, e os scripts dela ficariam bloqueados no navegador. Força toda página a
// renderizar por requisição — inclusive as que hoje são estáticas (home, "como funciona",
// privacidade) — para o nonce nunca faltar, mesmo em páginas que venham a ser adicionadas depois.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${plexSans.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-4 focus:py-2"
        >
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
