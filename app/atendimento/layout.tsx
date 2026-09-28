import type { Metadata } from "next";
import type { ReactNode } from "react";

// Reforço do cabeçalho X-Robots-Tag: páginas de atendimento nunca devem ser indexadas.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AtendimentoLayout({ children }: { children: ReactNode }) {
  return children;
}
