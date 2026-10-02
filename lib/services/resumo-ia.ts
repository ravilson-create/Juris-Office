import "server-only";
import type { Db } from "@/lib/db/types";
import type { ResumoCaso } from "@/domain/ai/resumo";

export type ResumoIARow = {
  case_id: string;
  sintese: string;
  pedido_principal: string;
  pontos_chave: string[];
  documentos_faltantes: string[];
  riscos_aparentes: string[];
  modelo: string;
  gerado_por: string;
  gerado_em: string;
};

export async function buscarResumoIA(db: Db, caseId: string): Promise<ResumoIARow | null> {
  const rows = await db.query<ResumoIARow>("SELECT * FROM case_ai_summaries WHERE case_id = $1", [
    caseId,
  ]);
  return rows[0] ?? null;
}

/** Gerar de novo substitui o resumo anterior — nunca acumula histórico (mesmo padrão de case_viability). */
export async function salvarResumoIA(
  db: Db,
  params: { caseId: string; resumo: ResumoCaso; modelo: string; geradoPor: string },
): Promise<void> {
  await db.query(
    `INSERT INTO case_ai_summaries(
       case_id, sintese, pedido_principal, pontos_chave, documentos_faltantes, riscos_aparentes,
       modelo, gerado_por, gerado_em
     ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, now())
     ON CONFLICT (case_id) DO UPDATE SET
       sintese = excluded.sintese, pedido_principal = excluded.pedido_principal,
       pontos_chave = excluded.pontos_chave, documentos_faltantes = excluded.documentos_faltantes,
       riscos_aparentes = excluded.riscos_aparentes, modelo = excluded.modelo,
       gerado_por = excluded.gerado_por, gerado_em = now()`,
    [
      params.caseId,
      params.resumo.sintese,
      params.resumo.pedidoPrincipal,
      JSON.stringify(params.resumo.pontosChave),
      JSON.stringify(params.resumo.documentosFaltantes),
      JSON.stringify(params.resumo.riscosAparentes),
      params.modelo,
      params.geradoPor,
    ],
  );
}
