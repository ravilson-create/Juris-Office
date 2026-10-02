import "server-only";
import type { Db } from "@/lib/db/types";

export type MembroEquipeRow = {
  user_id: string;
  role: "lawyer" | "admin";
  oab_numero: string | null;
  oab_uf: string | null;
  oab_verificado_em: string | null;
  subscription_status: string | null;
};

/** A RLS (admin_office_profiles) já restringe ao escritório do ator. */
export async function listarEquipe(db: Db, officeId: string): Promise<MembroEquipeRow[]> {
  return db.query<MembroEquipeRow>(
    `SELECT p.user_id, p.role, p.oab_numero, p.oab_uf, p.oab_verificado_em,
       s.status AS subscription_status
     FROM profiles p
     LEFT JOIN LATERAL (
       SELECT status FROM lawyer_subscriptions
       WHERE lawyer_id = p.user_id ORDER BY valid_until DESC LIMIT 1
     ) s ON true
     WHERE p.office_id = $1 AND p.role IN ('lawyer', 'admin')
     ORDER BY p.role DESC, p.user_id`,
    [officeId],
  );
}
