import "server-only";
import type { Db } from "@/lib/db/types";

export type PapelEquipe = "lawyer" | "admin" | "staff";

export type AcessoEquipe =
  | { ok: true; role: PapelEquipe; officeId: string; oabConfirmada: boolean }
  | { ok: false; motivo: "sem_papel" | "sem_assinatura" };

/**
 * Checagem única de acesso à área profissional, usada no topo de toda página de /equipe —
 * substitui a consulta repetida de "lawyer_subscriptions WHERE lawyer_id = <este advogado>" que
 * cada página tinha (um advogado convidado pela equipe nunca tinha sua própria linha ali, então
 * nunca passava). Agora a assinatura é do escritório (office_has_active_subscription, migração
 * 0031): qualquer membro (lawyer/admin/staff) trabalha enquanto ela estiver em dia.
 *
 * OAB confirmada NÃO é mais checada aqui — deixou de bloquear leitura/elaboração de caso (agora é
 * só o gate de assinar contrato/petição/peça, nas próprias ações). O chamador decide para onde
 * redirecionar em cada motivo de falha, porque isso varia por página (algumas usam notFound(),
 * outras redirect para /atendimento/meus ou /assinatura).
 */
export async function acessoEquipe(db: Db, actor: string): Promise<AcessoEquipe> {
  const rows = await db.query<{
    role: string;
    office_id: string | null;
    oab_verificado_em: Date | null;
  }>("SELECT role, office_id, oab_verificado_em FROM profiles WHERE user_id = $1", [actor]);
  const perfil = rows[0];
  if (!perfil || !perfil.office_id || !["lawyer", "admin", "staff"].includes(perfil.role)) {
    return { ok: false, motivo: "sem_papel" };
  }
  const ativa = await db.query<{ ok: boolean }>(
    "SELECT office_has_active_subscription($1) AS ok",
    [perfil.office_id],
  );
  if (!ativa[0]?.ok) return { ok: false, motivo: "sem_assinatura" };
  return {
    ok: true,
    role: perfil.role as PapelEquipe,
    officeId: perfil.office_id,
    oabConfirmada: Boolean(perfil.oab_verificado_em),
  };
}
