"use server";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth/session";
import { privateQuery } from "@/lib/db/private";
import { checkRateLimit } from "@/lib/rate-limit";
import { professionalFields } from "@/domain/user/registration";
import { createBilling, refreshBilling, cancelBilling } from "@/lib/billing/service";
export type BillingState = { error?: string; message?: string } | null;
export async function billingAction(_state: BillingState, form: FormData): Promise<BillingState> {
  const id = await currentUserId();
  if (!id) return { error: "Entre na sua conta." };
  if (!(await checkRateLimit(`billing:${id}`, 20, 900)))
    return { error: "Aguarde antes de tentar novamente." };
  try {
    const action = form.get("action");
    if (action === "profile") {
      const data = professionalFields.safeParse(Object.fromEntries(form));
      if (!data.success) return { error: "Confira nome, CPF/CNPJ, OAB/UF e aceite dos termos." };
      const v = data.data;
      await privateQuery(
        `UPDATE professional_accounts SET name=$2,cpf_cnpj=$3,oab_number=$4,oab_state=$5,terms_accepted_at=now() WHERE id=$1`,
        [id, v.name, v.cpfCnpj, v.oabNumber, v.oabState],
      );
      await privateQuery(
        `UPDATE profiles SET role='lawyer',office_id='00000000-0000-4000-8000-000000000001' WHERE user_id=$1 AND role='citizen'`,
        [id],
      );
    } else if (action === "create") {
      const plan = form.get("plan");
      if (plan !== "monthly" && plan !== "yearly") return { error: "Plano inválido." };
      await createBilling(id, plan);
    } else if (action === "refresh") await refreshBilling(id);
    else if (action === "cancel") {
      if (form.get("confirm") !== "on") return { error: "Confirme o cancelamento." };
      await cancelBilling(id);
    } else return { error: "Operação inválida." };
  } catch {
    return {
      error:
        "Não foi possível concluir. Confira seus dados e a configuração do Asaas sandbox. Se o problema persistir, procure o administrador.",
    };
  }
  revalidatePath("/assinatura");
  revalidatePath("/equipe");
  return { message: "Solicitação concluída. Confira a situação abaixo." };
}
