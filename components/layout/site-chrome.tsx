"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * O cabeçalho e rodapé públicos (logo, "Início/Como funciona/Entrar", rodapé institucional) não
 * fazem sentido dentro da área profissional: ela já tem a própria navegação (EquipeShell, barra
 * lateral + topo) e mostrar os dois juntos duplicava a logo no alto da página. Única exceção por
 * enquanto é "/equipe" — as outras páginas autenticadas (ex.: /mfa) continuam com o cabeçalho
 * público normalmente.
 *
 * `header`/`footer` chegam já renderizados pelo layout de servidor (nunca importe SiteHeader/
 * SiteFooter aqui dentro): como este arquivo é "use client", qualquer componente importado e
 * instanciado diretamente nele vira client também — e o SiteHeader puxa lib/auth/session, que por
 * sua vez toca um módulo "server-only". Recebê-los como elementos já prontos evita isso.
 */
export function SiteChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const areaProfissional = pathname?.startsWith("/equipe") ?? false;
  if (areaProfissional) return <>{children}</>;
  return (
    <>
      {header}
      {children}
      {footer}
    </>
  );
}
