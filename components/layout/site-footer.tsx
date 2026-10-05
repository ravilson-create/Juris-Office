import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { APP_NAME } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface print:hidden">
      <div className="mx-auto grid max-w-5xl gap-4 px-5 py-8 text-sm text-muted sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-3">
          <BrandLogo size="sm" mono />
          <p className="max-w-prose">
            {APP_NAME} organiza as informações que você digita em um dossiê e encaminha ao
            advogado responsável pelo seu caso. Não substitui a orientação de um profissional
            habilitado nem garante resultado.
          </p>
        </div>
        <ul className="flex gap-5">
          <li>
            <Link href="/privacidade" className="hover:text-ink">
              Privacidade
            </Link>
          </li>
          <li>
            <Link href="/como-funciona" className="hover:text-ink">
              Como funciona
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
