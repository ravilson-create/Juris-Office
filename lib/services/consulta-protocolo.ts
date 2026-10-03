import "server-only";
import type { Db } from "@/lib/db/types";
import { PgDossierRepository } from "@/lib/repositories/pg/dossier-repository";
import type { Dossier } from "@/domain/dossier/schema";
import { CASE_STATUS_LABEL, isEditableByCitizen } from "@/domain/case/status";
import type { CaseStatus } from "@/domain/case/schema";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";

export type ResultadoConsultaProtocolo = {
  protocol: string;
  areaName: string;
  statusLabel: string;
  updatedAt: string;
  finalized: boolean;
  dossier: Dossier | null;
};

/**
 * Consulta pública por protocolo + CPF (ver app/atendimento/meus) — a alternativa segura ao
 * "conhecer o protocolo dá acesso": o protocolo sozinho nunca bastou neste app (ver
 * canAccessCase/owns_case), e continua não bastando aqui — o CPF tem que bater com o da
 * identificação. Recebe `db` pronto (o chamador passa getMaintenanceDb(), que ignora RLS): a
 * sessão/login de quem está consultando não tem nenhuma relação com o dono do atendimento, então
 * a RLS normal (que decide por sessão) bloquearia a leitura mesmo com o CPF certo. A própria
 * comparação do CPF abaixo é a autorização de fato, não a RLS.
 *
 * Nunca revela qual dado está errado (protocolo inexistente vs. CPF não bate) — sempre null,
 * mesma mensagem genérica no chamador.
 */
export async function consultarAtendimentoPorProtocolo(
  db: Db,
  protocol: string,
  cpfDigitos: string,
): Promise<ResultadoConsultaProtocolo | null> {
  const rows = await db.query<{
    id: string;
    protocol: string;
    status: CaseStatus;
    legal_area_id: string;
    updated_at: string;
    cpf: string | null;
  }>(
    `SELECT id, protocol, status, legal_area_id, updated_at, applicant->>'cpf' AS cpf
     FROM legal_cases WHERE protocol = $1`,
    [protocol],
  );
  const row = rows[0];
  if (!row || !row.cpf || row.cpf !== cpfDigitos) return null;

  const finalized = !isEditableByCitizen(row.status);
  const dossier = finalized ? await new PgDossierRepository(db).findLatest(row.id) : null;
  return {
    protocol: row.protocol,
    areaName: LEGAL_AREAS.find((a) => a.id === row.legal_area_id)?.name ?? "—",
    statusLabel: CASE_STATUS_LABEL[row.status],
    updatedAt: row.updated_at,
    finalized,
    dossier,
  };
}
