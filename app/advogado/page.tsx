import Link from "next/link";
import { subscriptionPlans, formatPlanPrice } from "@/lib/billing/plans";
import { authEnabled } from "@/lib/auth/session";

export default function AdvogadoPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="font-semibold text-teal-strong">Júris Office para advogados</p>
      <h1 className="mt-3 max-w-2xl text-4xl">Seus casos jurídicos em um só lugar</h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Consulte os dossiês dos casos atribuídos a você, organize sua fila e registre notas internas
        para o acompanhamento do escritório.
      </p>
      {authEnabled ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/equipe" className="rounded-md bg-navy px-5 py-3 font-semibold text-white">
            Acessar área profissional
          </Link>
          <Link
            href="/advogado/cadastro"
            className="rounded-md border border-line px-5 py-3 font-semibold"
          >
            Começar teste grátis
          </Link>
        </div>
      ) : (
        <p className="mt-8 rounded-md border border-line bg-surface p-4">
          Cadastro e acesso profissional aguardam a ativação da autenticação nesta instalação.
        </p>
      )}
      <section className="mt-12" aria-labelledby="planos-title">
        <h2 id="planos-title" className="text-2xl">
          Planos profissionais
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {subscriptionPlans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-line bg-surface p-6">
              <h3 className="text-xl">{plan.label}</h3>
              <p className="mt-3 text-2xl font-semibold">
                {formatPlanPrice(plan.amountCents)}/{plan.interval}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          7 dias grátis, sem cartão. A fatura só é gerada perto do fim do teste.
        </p>
      </section>
    </main>
  );
}
