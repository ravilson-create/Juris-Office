import "server-only";
import type { Db } from "@/lib/db/types";

export type AdvogadoDisponivelRow = {
  lawyer_id: string;
  escritorio: string;
  cidade: string | null;
  uf: string | null;
  oab_numero: string;
  oab_uf: string;
};

/**
 * Diretório entre todos os escritórios cadastrados — base para o cliente escolher advogado no
 * fim do atendimento (ver migração 0022). A função SQL já filtra por OAB confirmada e assinatura
 * ativa; aqui só repassa área (obrigatória) e UF (opcional).
 */
export async function listarAdvogadosDisponiveis(
  db: Db,
  areaId: string,
  uf?: string | null,
): Promise<AdvogadoDisponivelRow[]> {
  return db.query<AdvogadoDisponivelRow>("SELECT * FROM listar_advogados_disponiveis($1, $2)", [
    areaId,
    uf ?? null,
  ]);
}
