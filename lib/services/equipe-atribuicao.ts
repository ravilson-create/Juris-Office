import "server-only";
import type { Db } from "@/lib/db/types";
import { STATUS_PROFISSIONAL } from "@/domain/case/status";

export async function atribuirAdvogado(
  db: Db,
  actor: string,
  caseId: string,
  lawyerId: string,
): Promise<"ok" | "existente" | "indisponivel"> {
  return db.transaction(async (tx) => {
    const inserted = await tx.query<{ case_id: string }>(
      `INSERT INTO case_assignments(case_id,lawyer_id,office_id)
       SELECT c.id,$2,c.office_id FROM legal_cases c
       WHERE c.id=$1 AND c.status=ANY($3::text[])
       ON CONFLICT DO NOTHING RETURNING case_id`,
      [caseId, lawyerId, STATUS_PROFISSIONAL],
    );
    if (inserted.length) {
      await tx.query(
        "INSERT INTO audit_logs(actor_id,case_id,action) VALUES ($1,$2,'assign_lawyer')",
        [actor, caseId],
      );
      return "ok";
    }
    const existing = await tx.query(
      "SELECT case_id FROM case_assignments WHERE case_id=$1 AND lawyer_id=$2",
      [caseId, lawyerId],
    );
    return existing.length ? "existente" : "indisponivel";
  });
}
