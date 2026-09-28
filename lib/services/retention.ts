import "server-only";
import type { Db } from "@/lib/db/types";

// Atendimentos ainda não enviados: quem esquece o navegador aberto não deve ficar pra sempre.
const NAO_FINALIZADOS = ["draft", "triage", "awaiting_documents", "ready_for_review"] as const;

export interface RetentionResult {
  atendimentosNaoFinalizadosRemovidos: number;
  atendimentosFinalizadosRemovidos: number;
  janelasDeLimiteRemovidas: number;
}

/**
 * Núcleo testável da limpeza periódica (P1 do plano mestre): atendimentos de teste não
 * finalizados há mais de 30 dias, e finalizados há mais de 90 dias. Chamado por
 * app/api/cron/limpeza. Prazos provisórios, a rever com o dono do produto quando houver
 * volume real de uso — hoje o app está só em fase de testes, com dados fictícios.
 */
export async function runRetentionCleanup(db: Db): Promise<RetentionResult> {
  const naoFinalizados = await db.query(
    `DELETE FROM legal_cases
     WHERE status = ANY($1) AND updated_at < now() - interval '30 days'
     RETURNING id`,
    [NAO_FINALIZADOS],
  );
  const finalizados = await db.query(
    `DELETE FROM legal_cases
     WHERE NOT (status = ANY($1)) AND coalesce(submitted_at, updated_at) < now() - interval '90 days'
     RETURNING id`,
    [NAO_FINALIZADOS],
  );
  // Contadores de limite de requisições não precisam sobreviver além da própria janela.
  const limites = await db.query(
    `DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 day' RETURNING rate_key`,
  );
  return {
    atendimentosNaoFinalizadosRemovidos: naoFinalizados.length,
    atendimentosFinalizadosRemovidos: finalizados.length,
    janelasDeLimiteRemovidas: limites.length,
  };
}
