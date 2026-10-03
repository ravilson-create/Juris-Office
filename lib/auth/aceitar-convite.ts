import "server-only";
import { getDb } from "@/lib/db/connection";
import type { currentIdentity } from "./session";

/**
 * Chamada a cada login autenticado (ver app/atendimento/layout.tsx e app/equipe/layout.tsx),
 * sempre com o e-mail que a própria Neon Auth confirmou para a sessão — nunca um valor de
 * formulário. Sem convite pendente para esse e-mail, não faz nada (o caminho comum). E-mail não
 * verificado nunca aceita convite — mesma exigência do bootstrap do admin geral (bootstrap-admin.ts).
 *
 * Usa getDb() (papel restrito, com RLS), não getMaintenanceDb(): aceitar_convite_equipe() é
 * SECURITY DEFINER e lê app_actor_id() internamente, que só resolve quando app.user_id foi
 * configurado na conexão — isso só acontece em PgDb.transaction() (ver lib/db/pg-db.ts), pelo
 * caminho de getDb(). getMaintenanceDb() conecta como dono do esquema, sem nunca fazer esse
 * set_config, então a função sempre veria app_actor_id() nulo e voltaria sem efeito nenhum.
 */
export async function aceitarConvitePendente(
  identity: NonNullable<Awaited<ReturnType<typeof currentIdentity>>>,
) {
  if (!identity.emailVerified) return;
  await getDb().query("SELECT aceitar_convite_equipe($1)", [identity.email]);
}
