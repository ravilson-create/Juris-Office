import "server-only";
import type { Queryable } from "@/lib/db/types";
import { privateTransaction } from "@/lib/db/private";
import { asaas, payments, safeInvoiceUrl } from "./asaas";
import { subscriptionPlans } from "./plans";
import { paidPeriodEnd } from "./period";
export type Billing = {
  lawyer_id: string;
  plan_id: "monthly" | "yearly";
  customer_id: string | null;
  subscription_id: string | null;
  state: string;
  invoice_url: string | null;
  cancel_requested: boolean;
};
export async function createBilling(lawyerId: string, planId: "monthly" | "yearly") {
  return privateTransaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`billing:${lawyerId}`]);
    const [u] = await tx.query<{
      name: string;
      email: string;
      cpf_cnpj: string;
      oab_number: string;
    }>(
      "SELECT name,email,cpf_cnpj,oab_number FROM professional_accounts WHERE id=$1 AND enabled=true",
      [lawyerId],
    );
    if (!u?.cpf_cnpj || !u.oab_number)
      throw new Error("Complete seu cadastro profissional antes de gerar a cobrança.");
    await tx.query(
      "INSERT INTO billing_accounts(lawyer_id,plan_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [lawyerId, planId],
    );
    const [b] = await tx.query<Billing>(
      "SELECT * FROM billing_accounts WHERE lawyer_id=$1 FOR UPDATE",
      [lawyerId],
    );
    if (b.subscription_id) {
      await reconcile(tx, b);
      return;
    }
    const ref = `juris-office:${lawyerId}`;
    let customerId = b.customer_id;
    if (!customerId) {
      const found = await asaas<{ data: { id: string }[] }>(
        `/customers?externalReference=${encodeURIComponent(ref)}&limit=2`,
      );
      if (found.data.length > 1)
        throw new Error("Cadastros de cobrança duplicados. Solicite revisão ao administrador.");
      customerId =
        found.data[0]?.id ??
        (
          await asaas<{ id: string }>("/customers", "POST", {
            name: u.name,
            email: u.email,
            cpfCnpj: u.cpf_cnpj,
            externalReference: ref,
            notificationDisabled: true,
          })
        ).id;
    }
    const prior = await asaas<{ data: { id: string; value: number; cycle: string }[] }>(
      `/subscriptions?externalReference=${encodeURIComponent(ref)}&limit=2`,
    );
    if (prior.data.length > 1)
      throw new Error("Assinaturas duplicadas. Solicite revisão ao administrador.");
    const plan = subscriptionPlans.find((p) => p.id === planId)!;
    let subscription = prior.data[0];
    if (
      subscription &&
      (subscription.value !== plan.amountCents / 100 ||
        subscription.cycle !== (planId === "yearly" ? "YEARLY" : "MONTHLY"))
    )
      throw new Error(
        "Há uma cobrança anterior de outro plano. Solicite revisão antes de continuar.",
      );
    if (!subscription)
      subscription = await asaas("/subscriptions", "POST", {
        customer: customerId,
        billingType: "UNDEFINED",
        value: plan.amountCents / 100,
        nextDueDate: new Date().toISOString().slice(0, 10),
        cycle: planId === "yearly" ? "YEARLY" : "MONTHLY",
        description: `Júris Office · ${plan.label} · TESTE`,
        externalReference: ref,
      });
    await tx.query(
      `UPDATE billing_accounts SET plan_id=$2,customer_id=$3,subscription_id=$4,updated_at=now() WHERE lawyer_id=$1`,
      [lawyerId, planId, customerId, subscription.id],
    );
    await reconcile(tx, {
      ...b,
      plan_id: planId,
      customer_id: customerId,
      subscription_id: subscription.id,
    });
  });
}
export async function reconcile(tx: Queryable, b: Billing) {
  if (!b.subscription_id) return;
  const list = await payments(b.subscription_id);
  const price = subscriptionPlans.find((p) => p.id === b.plan_id)!.amountCents / 100;
  const paid = list.filter(
    (p) =>
      p.subscription === b.subscription_id &&
      ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(p.status) &&
      p.value >= price,
  );
  const until = paid.reduce((max, p) => {
    const end = paidPeriodEnd(p.dueDate, b.plan_id);
    return end > max ? end : max;
  }, new Date(0));
  const pending = list
    .filter((p) => ["PENDING", "OVERDUE"].includes(p.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const active = until > new Date();
  const state = active
    ? "active"
    : b.cancel_requested
      ? "canceled"
      : pending?.status === "OVERDUE"
        ? "past_due"
        : "pending";
  await tx.query(
    `UPDATE billing_accounts SET state=$2,invoice_url=$3,updated_at=now() WHERE lawyer_id=$1`,
    [b.lawyer_id, state, safeInvoiceUrl(pending?.invoiceUrl)],
  );
  await tx.query(
    `INSERT INTO lawyer_subscriptions(lawyer_id,status,valid_until,provider,external_ref)
 VALUES($1,$2,$3,'asaas_sandbox',$4) ON CONFLICT(lawyer_id) DO UPDATE SET status=excluded.status,
 valid_until=excluded.valid_until,provider=excluded.provider,external_ref=excluded.external_ref,updated_at=now()`,
    [
      b.lawyer_id,
      active ? "active" : state === "canceled" ? "canceled" : "past_due",
      until,
      b.subscription_id,
    ],
  );
}
export async function refreshBilling(lawyerId: string) {
  await privateTransaction(async (tx) => {
    const [b] = await tx.query<Billing>(
      "SELECT * FROM billing_accounts WHERE lawyer_id=$1 FOR UPDATE",
      [lawyerId],
    );
    if (b) await reconcile(tx, b);
  });
}
export async function cancelBilling(lawyerId: string) {
  await privateTransaction(async (tx) => {
    const [b] = await tx.query<Billing>(
      "SELECT * FROM billing_accounts WHERE lawyer_id=$1 FOR UPDATE",
      [lawyerId],
    );
    if (!b?.subscription_id || b.cancel_requested) return;
    // Inativar interrompe novas cobranças sem apagar o histórico usado na conciliação.
    await asaas(`/subscriptions/${encodeURIComponent(b.subscription_id)}`, "PUT", {
      status: "INACTIVE",
    });
    await tx.query(
      "UPDATE billing_accounts SET cancel_requested=true,updated_at=now() WHERE lawyer_id=$1",
      [lawyerId],
    );
    await reconcile(tx, { ...b, cancel_requested: true });
  });
}
export async function handleBillingEvent(id: string, eventType: string, subscriptionId: string) {
  await privateTransaction(async (tx) => {
    const rows = await tx.query(
      "INSERT INTO billing_events(id,event_type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
      [id, eventType],
    );
    if (!rows.length) return;
    const [b] = await tx.query<Billing>(
      "SELECT * FROM billing_accounts WHERE subscription_id=$1 FOR UPDATE",
      [subscriptionId],
    );
    // Pode chegar antes do commit do cadastro: devolvemos falha para reentrega.
    if (!b) throw new Error("Assinatura ainda não vinculada");
    if (eventType === "SUBSCRIPTION_DELETED" || eventType === "SUBSCRIPTION_INACTIVATED") {
      await tx.query("UPDATE billing_accounts SET cancel_requested=true WHERE lawyer_id=$1", [
        b.lawyer_id,
      ]);
      b.cancel_requested = true;
    }
    // Consulta o estado atual no gateway: eventos antigos não sobrescrevem pagamentos recentes.
    await reconcile(tx, b);
  });
}
