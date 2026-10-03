import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BfcacheGuard } from "@/components/case/bfcache-guard";
import { authEnabled, currentIdentity } from "@/lib/auth/session";
import { bootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { getDb } from "@/lib/db/connection";

// Reforço do cabeçalho X-Robots-Tag: páginas de atendimento nunca devem ser indexadas.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AtendimentoLayout({ children }: { children: ReactNode }) {
  // Entrar na conta é sempre opcional aqui: o atendimento anônimo tem que continuar funcionando
  // mesmo com a Neon Auth configurada — por isso nunca redireciona para o login. Só identifica
  // e prepara o perfil de quem já estiver logado (p.ex. vindo de /equipe).
  if (authEnabled) {
    const identity = await currentIdentity();
    if (identity) {
      await getDb().query(
        `INSERT INTO profiles(user_id, role, email) VALUES ($1, 'citizen', $2)
         ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email`,
        [identity.id, identity.email],
      );
      await bootstrapAdmin(identity);
    }
  }
  return (
    <>
      <BfcacheGuard />
      {children}
    </>
  );
}
