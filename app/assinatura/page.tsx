import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { subscriptionPlans, formatPlanPrice } from "@/lib/billing/plans";
import { buscarPropriaAssinatura } from "./actions";
import { PainelAssinatura } from "./painel-assinatura";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");

  const assinatura = await buscarPropriaAssinatura(actor);

  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <h1 className="text-3xl">Assinatura profissional</h1>
      {assinatura ? (
        <PainelAssinatura assinatura={assinatura} />
      ) : (
        <>
          <p className="mt-4">
            Escolha um plano para acessar os casos atribuídos ao seu perfil de advogado.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {subscriptionPlans.map((plan) => (
              <Link
                key={plan.id}
                href={`/advogado/cadastro?plano=${plan.id}`}
                className="rounded-xl border p-5 hover:border-navy"
              >
                <h2 className="text-xl font-semibold">{plan.label}</h2>
                <p className="mt-2 text-2xl font-semibold">
                  {formatPlanPrice(plan.amountCents)}{" "}
                  <span className="text-base font-normal">/{plan.interval}</span>
                </p>
                <p className="mt-3 font-medium text-navy">Escolher este plano →</p>
              </Link>
            ))}
          </div>
          <Link
            href="/advogado/cadastro"
            className="mt-6 inline-block rounded bg-navy px-5 py-3 font-semibold text-white"
          >
            Começar teste grátis de 7 dias
          </Link>
        </>
      )}
    </main>
  );
}
