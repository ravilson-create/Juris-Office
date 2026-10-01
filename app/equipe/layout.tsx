import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb, hasDatabase } from "@/lib/db/connection";
import { mfaVerificadoNesteNavegador } from "@/lib/auth/mfa-cookie";
import { buscarMfa } from "@/lib/services/mfa";

/**
 * Único ponto de exigência de MFA para toda a área profissional: cada página aqui dentro
 * continua com sua própria checagem de papel/assinatura/OAB (são requisitos diferentes, com
 * destinos de redirecionamento diferentes), mas o segundo fator — quando a pessoa o ativou — é
 * checado uma vez só, aqui, antes de qualquer uma delas renderizar.
 */
export default async function EquipeLayout({ children }: { children: ReactNode }) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  if (hasDatabase()) {
    const db = getDb();
    const profile = await db.query<{ role: string }>(
      "SELECT role FROM profiles WHERE user_id = $1",
      [actor],
    );
    if (profile[0] && ["lawyer", "admin"].includes(profile[0].role)) {
      const mfa = await buscarMfa(db, actor);
      if (mfa?.enabled_at && !(await mfaVerificadoNesteNavegador(actor))) {
        redirect("/mfa/verificar");
      }
    }
  }
  return <>{children}</>;
}
