import "server-only";
import { redirect } from "next/navigation";
import { currentUserId } from "./session";
import { acessoEquipe } from "./equipe-acesso";
import { getDb } from "@/lib/db/connection";
import { buscarMfa } from "@/lib/services/mfa";
import { mfaVerificadoNesteNavegador } from "./mfa-cookie";

/** Revalidado em páginas, downloads e em cada ação, inclusive chamadas diretas. */
export async function requireFinancialAccess() {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const access = await acessoEquipe(db, actor);
  if (!access.ok) redirect(access.motivo === "sem_papel" ? "/atendimento/meus" : "/assinatura");
  const mfa = await buscarMfa(db, actor);
  if (mfa?.enabled_at && !(await mfaVerificadoNesteNavegador(actor))) redirect("/mfa/verificar");
  return { db, actor, office: access.officeId, role: access.role };
}
