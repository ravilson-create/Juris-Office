"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { subscriptionPlans } from "@/lib/billing/plans";
import {
  buscarFaturaAssinaturaAsaas,
  cancelarAssinaturaAsaas,
  atualizarAssinaturaAsaas,
} from "@/lib/billing/asaas";

type Assinatura = {
  status: string;
  invoice_url: string | null;
  valid_until: string;
  plano_id: string | null;
  external_ref: string | null;
  cancelar_em_renovacao: boolean;
  billing_cycle: "MONTHLY" | "YEARLY";
  cancellation_requested_at: string | null;
};

async function buscarPropriaAssinatura(actor: string): Promise<Assinatura | null> {
  const rows = await getDb().query<Assinatura>(
    `SELECT status, invoice_url, valid_until, plano_id, external_ref, cancelar_em_renovacao, billing_cycle, cancellation_requested_at
     FROM lawyer_subscriptions WHERE lawyer_id = $1`,
    [actor],
  );
  return rows[0] ?? null;
}

export async function buscarLinkPagamento(): Promise<{ error?: string }> {
  const actor = await currentUserId();
  if (!actor) return { error: "Não autenticado." };
  const atual = await buscarPropriaAssinatura(actor);
  if (!atual) return { error: "Nenhuma assinatura encontrada." };
  if (atual.invoice_url) {
    return {};
  }
  if (!atual.external_ref) {
    return {
      error: "Esta assinatura ainda não está integrada com o gateway de pagamento. Contate o suporte.",
    };
  }
  try {
    const fatura = await buscarFaturaAssinaturaAsaas(atual.external_ref);
    if (!fatura) {
      return {
        error:
          "Ainda não há fatura gerada. Isso costuma acontecer perto do fim do teste grátis — tente novamente mais perto da data.",
      };
    }
    await getDb().query("SELECT set_own_subscription_invoice($1, $2)", [
      fatura.invoiceUrl,
      fatura.dueDate,
    ]);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao buscar a fatura." };
  }
  revalidatePath("/assinatura");
  return {};
}

export async function cancelarAssinatura(): Promise<{ error?: string }> {
  const actor = await currentUserId();
  if (!actor) return { error: "Não autenticado." };
  const atual = await buscarPropriaAssinatura(actor);
  if (!atual) return { error: "Nenhuma assinatura encontrada." };
  if (atual.cancelar_em_renovacao) return {};
  if (atual.external_ref) {
    try {
      await cancelarAssinaturaAsaas(atual.external_ref);
    } catch (error) {
      console.error("[assinatura] falha ao cancelar na Asaas", error);
    }
  }
  await getDb().query("SELECT cancel_own_subscription()");
  revalidatePath("/assinatura");
  return {};
}

export async function trocarPlano(form: FormData): Promise<{ error?: string }> {
  const actor = await currentUserId();
  if (!actor) return { error: "Não autenticado." };
  const planoId = z
    .enum(subscriptionPlans.map((p) => p.id) as [string, ...string[]])
    .safeParse(form.get("planoId"));
  if (!planoId.success) return { error: "Plano inválido." };

  const atual = await buscarPropriaAssinatura(actor);
  if (!atual) return { error: "Nenhuma assinatura encontrada." };
  if (atual.cancelar_em_renovacao) {
    return { error: "Sua assinatura já está marcada para cancelamento." };
  }
  if (atual.plano_id === planoId.data) return {};
  if (atual.plano_id === "yearly" && planoId.data === "monthly") {
    return { error: "A troca do plano anual para o mensal não está disponível durante o período anual contratado." };
  }
  const plano = subscriptionPlans.find((p) => p.id === planoId.data)!;

  // Sem external_ref (teste grátis sem integração concluída com a Asaas), trocar aqui não muda
  // cobrança nenhuma — bloqueia para nunca liberar um plano maior sem cobrança correspondente.
  if (!atual.external_ref) {
    return {
      error: "Esta assinatura ainda não está integrada com o gateway de pagamento. Contate o suporte.",
    };
  }
  try {
    const cycle = plano.id === "yearly" ? "YEARLY" : "MONTHLY";
    await atualizarAssinaturaAsaas(atual.external_ref, { valor: plano.amountCents / 100, cycle });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erro ao trocar de plano." };
  }
  await getDb().query("SELECT set_own_subscription_plan($1, $2)", [
    planoId.data,
    plano.id === "yearly" ? "YEARLY" : "MONTHLY",
  ]);
  revalidatePath("/assinatura");
  return {};
}

export { buscarPropriaAssinatura };
export type { Assinatura };
