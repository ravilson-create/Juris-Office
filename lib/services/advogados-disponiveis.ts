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

export type AdvogadoEscolhidoRow = { lawyer_id: string; escritorio: string };

/** Null quando o cliente ainda não escolheu ninguém (ou escolheu "pular" — ver migração 0023). */
export async function buscarAdvogadoEscolhido(
  db: Db,
  caseId: string,
): Promise<AdvogadoEscolhidoRow | null> {
  const rows = await db.query<AdvogadoEscolhidoRow>(
    "SELECT * FROM advogado_escolhido_atendimento($1)",
    [caseId],
  );
  return rows[0] ?? null;
}

/** Revalida tudo de novo dentro da função SQL — nunca confia na lista que o navegador mostrou. */
export async function escolherAdvogado(db: Db, caseId: string, lawyerId: string): Promise<void> {
  await db.query("SELECT escolher_advogado_atendimento($1, $2)", [caseId, lawyerId]);
}
