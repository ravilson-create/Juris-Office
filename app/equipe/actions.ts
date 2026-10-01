"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";

export async function assignLawyer(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const lawyerId = z.string().min(1).max(255).safeParse(form.get("lawyerId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !lawyerId.success) return;
  const db = getDb();
  // O banco verifica: administrador do escritório, advogado do mesmo escritório,
  // caso finalizado daquele escritório. A atribuição nunca confia no formulário.
  await db.transaction(async (tx) => {
    const inserted = await tx.query<{ case_id: string }>(
      `INSERT INTO case_assignments(case_id, lawyer_id, office_id)
       SELECT c.id, $2, c.office_id FROM legal_cases c WHERE c.id = $1
       ON CONFLICT DO NOTHING RETURNING case_id`,
      [caseId.data, lawyerId.data],
    );
    if (inserted.length) {
      await tx.query(
        "INSERT INTO audit_logs(actor_id, case_id, action) VALUES ($1, $2, 'assign_lawyer')",
        [actor, caseId.data],
      );
    }
  });
  revalidatePath("/equipe");
}

export async function verifyLawyerOab(form: FormData) {
  const lawyerId = z.string().min(1).max(255).safeParse(form.get("lawyerId"));
  const actor = await currentUserId();
  if (!actor || !lawyerId.success) return;
  // A política RLS confere, dentro da função verify_lawyer_oab: só admin, só do mesmo
  // escritório, só advogado com OAB informada — nunca confia no formulário.
  await getDb().query("SELECT verify_lawyer_oab($1)", [lawyerId.data]);
  revalidatePath("/equipe/pendentes");
  revalidatePath("/equipe");
}

export async function addCaseNote(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const body = z.string().trim().min(1).max(4000).safeParse(form.get("body"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !body.success) return;
  // A política RLS exige acesso profissional ao caso e registra o autor da sessão.
  await getDb().query(
    "INSERT INTO case_notes(id, case_id, author_id, body) VALUES ($1, $2, $3, $4)",
    [crypto.randomUUID(), caseId.data, actor, body.data],
  );
  revalidatePath(`/equipe/${caseId.data}`);
}
