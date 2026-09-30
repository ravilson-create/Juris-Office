import Link from "next/link";
import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/auth/session";
import { privateQuery } from "@/lib/db/private";
import { sandboxConfigured, safeInvoiceUrl } from "@/lib/billing/asaas";
import { BillingForm, CompleteProfile } from "./billing-form";
import type { Billing } from "@/lib/billing/service";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentIdentity();
  if (!user) redirect("/auth/sign-in");
  const [account] = await privateQuery<{ cpf_cnpj: string; oab_number: string }>(
    "SELECT cpf_cnpj,oab_number FROM professional_accounts WHERE id=$1",
    [user.id],
  );
  const [b] = await privateQuery<Billing & { valid_until: Date | null }>(
    `SELECT b.*,s.valid_until FROM billing_accounts b LEFT JOIN lawyer_subscriptions s ON s.lawyer_id=b.lawyer_id WHERE b.lawyer_id=$1`,
    [user.id],
  );
  const invoice = safeInvoiceUrl(b?.invoice_url);
  const labels: Record<string, string> = {
    pending: "Aguardando pagamento",
    active: "Assinatura ativa",
    past_due: "Pagamento pendente",
    canceled: "Assinatura cancelada",
  };
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="font-semibold text-teal-strong">Asaas sandbox · sem cobrança real</p>
      <h1 className="mt-3 text-3xl">Minha assinatura</h1>
      <p className="mt-4">Olá, {user.name}. Gerencie seu plano e acompanhe o pagamento.</p>
      {!account?.cpf_cnpj || !account.oab_number ? (
        <CompleteProfile name={user.name} />
      ) : (
        <>
          <section className="mt-6 rounded border p-5">
            <h2 className="text-xl">
              {labels[b?.state ?? "pending"] ?? "Aguardando configuração"}
            </h2>
            {b?.valid_until && new Date(b.valid_until) > new Date() && (
              <p className="mt-2">
                Acesso até{" "}
                {new Date(b.valid_until).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
              </p>
            )}
            {b?.cancel_requested && <p>Renovação cancelada.</p>}
            {invoice && (
              <a
                href={invoice}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded bg-navy px-5 py-3 text-white"
              >
                Abrir pagamento de teste
              </a>
            )}
          </section>
          {!sandboxConfigured() && (
            <p className="mt-5 rounded border p-4">
              Seu cadastro está pronto. A geração de cobranças aguarda a configuração da conta Asaas
              sandbox pelo administrador.
            </p>
          )}
          <BillingForm
            configured={sandboxConfigured()}
            subscriptionId={b?.subscription_id}
            canceled={b?.cancel_requested}
            plan={b?.plan_id ?? "monthly"}
          />
        </>
      )}
      <Link className="mt-8 inline-block underline" href="/equipe">
        Ir para o painel do advogado
      </Link>
    </main>
  );
}
