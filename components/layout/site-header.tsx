import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { APP_NAME } from "@/lib/config";
import { authEnabled } from "@/lib/auth/session";

function IconBusca() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M16.5 16.5 13 13" strokeLinecap="round" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-5">
        <Link
          href="/"
          aria-label={`${APP_NAME} — página inicial`}
          className="shrink-0 no-underline"
        >
          <span className="sm:hidden">
            <BrandLogo size="sm" />
          </span>
          <span className="hidden sm:inline">
            <BrandLogo />
          </span>
        </Link>

        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm font-medium text-ink">
            <li>
              <Link href="/" className="hover:text-gold-strong">
                Início
              </Link>
            </li>
            <li>
              <Link href="/como-funciona" className="hover:text-gold-strong">
                Como funciona
              </Link>
            </li>
            <li>
              <Link href="/atendimento" className="hover:text-gold-strong">
                Áreas de atendimento
              </Link>
            </li>
            <li>
              <Link href="/advogado" className="hover:text-gold-strong">
                Para advogados
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <Link
            href="/atendimento/meus"
            aria-label="Meus atendimentos"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line px-2 py-2 text-sm font-medium text-ink hover:border-navy sm:gap-2 sm:px-3"
          >
            <IconBusca />
            <span className="sm:hidden">Meus</span>
            <span className="hidden sm:inline">Meus atendimentos</span>
          </Link>
          <Link
            href="/advogado/cadastro"
            aria-label="Assinar como advogado — teste grátis de 7 dias"
            className="whitespace-nowrap rounded-md bg-gold-strong px-2 py-2 text-sm font-medium text-white hover:brightness-90 sm:px-4"
          >
            Assinar
          </Link>
          {authEnabled && (
            <Link
              href="/auth/sign-in"
              aria-label="Entrar — área do advogado"
              className="hidden whitespace-nowrap rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:border-navy sm:inline-block sm:px-4"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
