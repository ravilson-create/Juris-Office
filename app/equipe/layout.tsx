import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { EquipeShell } from "@/components/layout/equipe-shell";
import { currentIdentity } from "@/lib/auth/session";
import { isAppOwner } from "@/lib/auth/bootstrap-admin";
import { aceitarConvitePendente } from "@/lib/auth/aceitar-convite";
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
  // Garante uma linha em profiles antes de tentar aceitar um convite pendente — quem chega direto
  // em /equipe por um link de convite pode nunca ter passado por /atendimento (onde esse insert
  // já acontecia), e aceitar_convite_equipe() só atualiza uma linha existente, nunca cria uma.
  await db.query(
    `INSERT INTO profiles(user_id, role, email) VALUES ($1, 'citizen', $2)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email`,
    [identity.id, identity.email],
  );
  await aceitarConvitePendente(identity);

  const rows = await db.query<{ role: string; office_name: string | null }>(
    `SELECT p.role, o.name AS office_name FROM profiles p
     LEFT JOIN offices o ON o.id = p.office_id WHERE p.user_id = $1`,
    [identity.id],
  );
  const profile = rows[0];
  if (!profile || !["lawyer", "admin"].includes(profile.role)) return <>{children}</>;

  const mfa = await buscarMfa(db, identity.id);
  if (mfa?.enabled_at && !(await mfaVerificadoNesteNavegador(identity.id))) {
    redirect("/mfa/verificar");
  }

  return (
    <EquipeShell
      email={identity.email}
      role={profile.role as "lawyer" | "admin"}
      officeName={profile.office_name ?? ""}
      isAppOwner={isAppOwner(identity)}
    >
      {children}
    </EquipeShell>
  );
}
