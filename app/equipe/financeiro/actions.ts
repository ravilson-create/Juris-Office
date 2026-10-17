"use server";
import { revalidatePath } from "next/cache";
import { requireFinancialAccess } from "@/lib/auth/financeiro-acesso";
import { entrySchema, moneyInput } from "@/domain/financeiro/schema";
import {
  cancelFinancialEntry,
  createFinancialEntry,
  importContractInstallment,
  settleFinancialEntry,
} from "@/lib/services/financeiro";

export type FinancialActionState = { ok: boolean; message: string };
export async function financialAction(
  _previous: FinancialActionState,
  form: FormData,
): Promise<FinancialActionState> {
  const { db, actor, office } = await requireFinancialAccess();
  const op = form.get("operation");
  try {
    if (op === "create") {
      const input = entrySchema.safeParse({
        requestId: form.get("requestId"),
        description: form.get("description"),
        counterparty: form.get("counterparty"),
        kind: form.get("kind"),
        direction: form.get("direction"),
        amountCents: moneyInput(form.get("amount")),
        dueDate: form.get("dueDate"),
        installments: Number(form.get("installments")),
        caseId: form.get("caseId") || null,
        notes: form.get("notes") ?? "",
      });
      if (!input.success)
        return { ok: false, message: input.error.issues[0]?.message ?? "Confira os campos." };
      await createFinancialEntry(db, actor, office, input.data);
    } else if (op === "settle") {
      await settleFinancialEntry(db, actor, {
        id: String(form.get("requestId")),
        entryId: String(form.get("entryId")),
        amountCents: moneyInput(form.get("amount")),
        paidOn: String(form.get("paidOn")),
        note: String(form.get("note") ?? ""),
      });
    } else if (op === "cancel") {
      await cancelFinancialEntry(db, String(form.get("entryId")));
    } else if (op === "import") {
      await importContractInstallment(db, actor, office, String(form.get("installmentId")));
    } else return { ok: false, message: "Operação inválida." };
  } catch {
    return {
      ok: false,
      message:
        "Não foi possível registrar. Confira valor, data, saldo e permissão. Registros com baixa não podem ser cancelados.",
    };
  }
  revalidatePath("/equipe/financeiro");
  return { ok: true, message: "Registro salvo com sucesso." };
}
