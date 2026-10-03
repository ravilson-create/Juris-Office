import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { EquipeShell } from "@/components/layout/equipe-shell";
import { currentIdentity } from "@/lib/auth/session";
import { getDb, hasDatabase } from "@/lib/db/connection";
import { mfaVerificadoNesteNavegador } from "@/lib/auth/mfa-cookie";
import { buscarMfa } from "@/lib/services/mfa";

/**
 * Único ponto de exigência de MFA para toda a área profissional: cada página aqui dentro
 * continua com sua própria checagem de papel/assinatura/OAB (são requisitos diferentes, com
 * destinos de redirecionamento diferentes), mas o segundo fator — quando a pessoa o ativou — é
 * checado uma vez só, aqui, antes de qualquer uma delas renderizar.
 *
 * A casca visual (EquipeShell, barra lateral + topo) só aparece para quem já é advogado/admin —
 * uma conta ainda sem papel atribuído continua vendo a página crua, que decide seu próprio
 * redirecionamento (ex.: de volta para "/atendimento/meus").
 */
export default async function EquipeLayout({ children }: { children: ReactNode }) {
  const identity = await currentIdentity();
  if (!identity) redirect("/auth/sign-in");
  if (!hasDatabase()) return <>{children}</>;

  const db = getDb();
  const rows = await db.query<{ role: string; office_name: string | null }>(
    `SELECT p.role, o.name AS office_name FROM profiles p
     LEFT JOIN offices o ON o.id = p.office_id WHERE p.user_id = $1`,
    [identity.id],
  );
  const profile = rows[0];
  if (!profile || !["lawyer", "admin"].includes(profile.role)) return <>{children}</>;

  // Backfill best-effort: cobre perfis gravados antes da coluna existir e o caso raro de a
  // pessoa trocar de e-mail na própria conta Neon Auth. Sem isso em todo visita, só quem passa
  // por /atendimento (bootstrap-admin.ts) teria o e-mail preenchido.
  await db.query("UPDATE profiles SET email = $2 WHERE user_id = $1 AND email IS DISTINCT FROM $2", [
    identity.id,
    identity.email,
  ]);

  const mfa = await buscarMfa(db, identity.id);
  if (mfa?.enabled_at && !(await mfaVerificadoNesteNavegador(identity.id))) {
    redirect("/mfa/verificar");
  }

  return (
    <EquipeShell
      email={identity.email}
      role={profile.role as "lawyer" | "admin"}
      officeName={profile.office_name ?? ""}
    >
      {children}
    </EquipeShell>
  );
}
