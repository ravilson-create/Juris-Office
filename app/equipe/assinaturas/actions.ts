"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentIdentity } from "@/lib/auth/session";
import { isAppOwner } from "@/lib/auth/bootstrap-admin";
import { getMaintenanceDb, hasDatabase } from "@/lib/db/connection";

const acaoSchema = z.enum(["ativar", "desativar"]);

/**
 * Ativar/desativar manualmente a assinatura de um advogado — exclusivo do administrador do
 * aplicativo (lib/auth/bootstrap-admin.ts#isAppOwner), fora da regra normal de isolamento por
 * escritório, mesmo padrão de listarAssinaturasAdvogados (getMaintenanceDb ignora RLS). Normal é
 * o status vir do webhook da Asaas; isto é só uma válvula manual para destravar ou suspender um
 * advogado sem esperar o gateway.
 */
export async function definirStatusAssinaturaAction(form: FormData): Promise<void> {
  const identity = await currentIdentity();
  if (!identity || !isAppOwner(identity)) return;
  if (!hasDatabase()) return;

  const lawyerId = z.string().min(1).safeParse(form.get("lawyerId"));
  const acao = acaoSchema.safeParse(form.get("acao"));
  if (!lawyerId.success || !acao.success) return;

  const db = getMaintenanceDb();
  try {
    if (acao.data === "ativar") {
      await db.query(
        `UPDATE lawyer_subscriptions
         SET status = 'active', valid_until = GREATEST(valid_until, now() + interval '30 days'),
             cancelar_em_renovacao = false, updated_at = now()
         WHERE lawyer_id = $1`,
        [lawyerId.data],
      );
    } else {
      await db.query(
        `UPDATE lawyer_subscriptions SET status = 'canceled', updated_at = now()
         WHERE lawyer_id = $1`,
        [lawyerId.data],
      );
    }
    await db.query("INSERT INTO audit_logs(actor_id, action) VALUES ($1, $2)", [
      identity.id,
      acao.data === "ativar" ? "admin_ativar_assinatura" : "admin_desativar_assinatura",
    ]);
  } finally {
    await db.close();
  }
  revalidatePath("/equipe/assinaturas");
}
