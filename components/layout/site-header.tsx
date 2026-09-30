import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { APP_NAME } from "@/lib/config";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between flex-wrap gap-4 px-5 py-4">
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
        <nav aria-label="Principal">
          <ul className="flex flex-wrap items-center gap-3 text-sm sm:gap-5">
            <li className="hidden sm:block">
              <Link href="/como-funciona" className="text-muted hover:text-ink">
                Como funciona
              </Link>
            </li>
            <li className="hidden sm:block">
              <Link href="/advogado" className="whitespace-nowrap text-navy hover:underline">
                Advogados
              </Link>
            </li>
            <li>
              <Link href="/consulta" className="font-medium text-navy hover:underline">
                Consultar protocolo
              </Link>
            </li>
            <li>
              <Link
                href="/atendimento/meus"
                aria-label="Meus atendimentos"
                className="whitespace-nowrap font-medium text-navy hover:underline"
              >
                <span className="sm:hidden">Meus</span>
                <span className="hidden sm:inline">Meus atendimentos</span>
              </Link>
            </li>
            <li>
              <Link
                href="/atendimento"
                aria-label="Iniciar atendimento"
                className="whitespace-nowrap rounded-md bg-navy px-3 py-2 font-medium text-white hover:bg-navy-strong sm:px-4"
              >
                <span className="sm:hidden">Iniciar</span>
                <span className="hidden sm:inline">Iniciar atendimento</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
