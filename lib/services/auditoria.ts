import "server-only";
import type { Db } from "@/lib/db/types";

/**
 * Registra que `actor` acessou os dados de `caseId` — não as ações que já se auditam por si
 * (atribuir advogado, decidir viabilidade etc.), mas a simples leitura, que até aqui não deixava
 * rastro nenhum. Chamado uma vez por carregamento da página do caso na área profissional, nunca
 * no lado do cidadão (ver chamador): ver o próprio caso não é o que esta trilha audita.
 */
export async function registrarLeituraCaso(
  db: Db,
  params: { actor: string; caseId: string },
): Promise<void> {
  await db.query("INSERT INTO audit_logs(actor_id, case_id, action) VALUES ($1, $2, 'read_case')", [
    params.actor,
    params.caseId,
  ]);
}
