import { CASE_STATUS_LABEL, STATUS_PROFISSIONAL } from "./status";
import type { CaseStatus } from "./schema";

export type ContagemStatus = { status: CaseStatus; label: string; total: number };

export type ResumoCasos = {
  total: number;
  porStatus: ContagemStatus[];
};

/**
 * Transforma linhas brutas de `GROUP BY status` (contagem vem como string do Postgres) num
 * resumo com todo status profissional presente, mesmo com zero casos — para a tela nunca
 * precisar decidir "mostra ou não a linha", só "total é zero".
 */
export function resumirContagemPorStatus(
  linhas: readonly { status: string; count: string | number }[],
): ResumoCasos {
  const porStatusMap = new Map(linhas.map((l) => [l.status, Number(l.count)]));
  const porStatus = STATUS_PROFISSIONAL.map((status) => ({
    status,
    label: CASE_STATUS_LABEL[status],
    total: porStatusMap.get(status) ?? 0,
  }));
  return {
    total: porStatus.reduce((soma, item) => soma + item.total, 0),
    porStatus,
  };
}
