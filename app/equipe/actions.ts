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

export type UpdateState = { error?: string; message?: string } | null;
export async function updateCaseStatus(_state: UpdateState, form: FormData): Promise<UpdateState> {
  const { caseStatusSchema } = await import("@/domain/case/schema");
  const { canTransition } = await import("@/domain/case/status");
  const input = z
    .object({ caseId: z.uuid(), status: caseStatusSchema, message: z.string().trim().max(2000) })
    .safeParse(Object.fromEntries(form));
  const actor = await currentUserId();
  if (!actor || !input.success) return { error: "Confira os dados." };
  const { checkRateLimit } = await import("@/lib/rate-limit");
  if (!(await checkRateLimit(`status:${actor}`, 60, 3600)))
    return { error: "Aguarde antes de atualizar novamente." };
  try {
    await getDb().transaction(async (tx) => {
      const [profile] = await tx.query<{ role: string }>(
        "SELECT role FROM profiles WHERE user_id=$1",
        [actor],
      );
      if (!profile || profile.role !== "lawyer")
        throw new Error("Apenas o advogado responsável pode atualizar o andamento.");
      const [c] = await tx.query<{ status: import("@/domain/case/schema").CaseStatus }>(
        "SELECT status FROM legal_cases WHERE id=$1 FOR UPDATE",
        [input.data.caseId],
      );
      if (!c || !canTransition(c.status, input.data.status))
        throw new Error("Atualização não permitida. Recarregue a página e confira o andamento.");
      if (c.status === input.data.status && !input.data.message) return;
      await tx.query("UPDATE legal_cases SET status=$2,updated_at=now() WHERE id=$1", [
        input.data.caseId,
        input.data.status,
      ]);
      await tx.query(
        "INSERT INTO case_public_updates(id,case_id,status,message,actor_id) VALUES($1,$2,$3,$4,$5)",
        [crypto.randomUUID(), input.data.caseId, input.data.status, input.data.message, actor],
      );
      await tx.query(
        "INSERT INTO audit_logs(actor_id,case_id,action) VALUES($1,$2,'update_status')",
        [actor, input.data.caseId],
      );
    });
  } catch {
    return {
      error:
        "Não foi possível atualizar. Confira sua assinatura, o acesso ao atendimento e o andamento selecionado.",
    };
  }
  revalidatePath(`/equipe/${input.data.caseId}`);
  revalidatePath("/equipe");
  return {
    message: "Andamento atualizado. A informação já está disponível na consulta do cliente.",
  };
}
