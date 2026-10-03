import "server-only";
import type { Db } from "@/lib/db/types";

/**
 * Linha da aba "Assinaturas de advogados" do administrador do aplicativo
 * (lib/auth/bootstrap-admin.ts#isAppOwner) — a assinatura (mensalidade cobrada pela Asaas) de cada
 * advogado, de todos os escritórios da plataforma, não só o do ator. Recebe um `db` sem RLS
 * (getMaintenanceDb() no chamador): a RLS normal de lawyer_subscriptions (migração 0004) só deixa
 * o próprio advogado ou o admin do mesmo escritório lerem, nunca todos os escritórios.
 */
export type AssinaturaAdvogadoRow = {
  lawyer_id: string;
  email: string | null;
  office_name: string | null;
  status: "trial" | "active" | "past_due" | "canceled";
  plano_id: string | null;
  valid_until: string;
  provider: string;
  external_ref: string;
  invoice_url: string | null;
  cancelar_em_renovacao: boolean;
  updated_at: string;
};

export async function listarAssinaturasAdvogados(db: Db): Promise<AssinaturaAdvogadoRow[]> {
  return db.query<AssinaturaAdvogadoRow>(
    `SELECT s.lawyer_id, p.email, o.name AS office_name, s.status, s.plano_id,
            s.valid_until, s.provider, s.external_ref, s.invoice_url, s.cancelar_em_renovacao,
            s.updated_at
     FROM lawyer_subscriptions s
     JOIN profiles p ON p.user_id = s.lawyer_id
     LEFT JOIN offices o ON o.id = p.office_id
     ORDER BY s.updated_at DESC`,
  );
}
