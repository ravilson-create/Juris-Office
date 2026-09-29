import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { formatPlanPrice, subscriptionPlans } from "@/lib/billing/plans";

export default async function AssinaturaPage() {
  if (!(await currentUserId())) redirect("/auth/sign-in");
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-3xl">Assinatura profissional</h1>
      <p className="mt-4">
        Escolha o plano para acessar os casos atribuídos ao seu perfil de advogado.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {subscriptionPlans.map((plan) => (
          <div key={plan.id} className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">{plan.label}</h2>
            <p className="mt-2 text-2xl font-semibold">
              {formatPlanPrice(plan.amountCents)}{" "}
              <span className="text-base font-normal">/{plan.interval}</span>
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4">
        O acesso exige uma assinatura ativa. A contratação on-line ainda está em preparação; nenhum
        pagamento é cobrado por esta página.
      </p>
    </main>
  );
}
