import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BfcacheGuard } from "@/components/case/bfcache-guard";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function AtendimentoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BfcacheGuard />
      {children}
    </>
  );
}
