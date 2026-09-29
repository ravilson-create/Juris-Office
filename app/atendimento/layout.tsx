import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BfcacheGuard } from "@/components/case/bfcache-guard";
import { redirect } from "next/navigation";
import { authEnabled, currentIdentity } from "@/lib/auth/session";
import { bootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { getDb } from "@/lib/db/connection";

// Reforço do cabeçalho X-Robots-Tag: páginas de atendimento nunca devem ser indexadas.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AtendimentoLayout({ children }: { children: ReactNode }) {
  if (authEnabled) {
    const identity = await currentIdentity();
    if (!identity) redirect("/auth/sign-in");
    await getDb().query(
      "INSERT INTO profiles(user_id, role) VALUES ($1, 'citizen') ON CONFLICT (user_id) DO NOTHING",
      [identity.id],
    );
    await bootstrapAdmin(identity);
  }
  return (
    <>
      <BfcacheGuard />
      {children}
    </>
  );
}
