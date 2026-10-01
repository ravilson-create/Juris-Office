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

      <details className="group mt-10 rounded-md border border-line bg-surface p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink [&::-webkit-details-marker]:hidden">
          <span>Precisa de ajuda para começar?</span>
          <span
            aria-hidden="true"
            className="text-teal-strong transition-transform group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <div>
            <p className="font-semibold text-ink">Como funciona o teste grátis?</p>
            <p className="mt-1">
              7 dias sem cartão de crédito. A fatura só é gerada perto do fim do período, e você
              pode cancelar antes disso sem custo.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Preciso comprovar minha OAB?</p>
            <p className="mt-1">
              Sim. Após o cadastro, a verificação da inscrição na OAB é obrigatória antes de
              acessar os casos — isso garante que apenas advogados vejam os dossiês dos clientes.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">O que acontece com os dados dos clientes?</p>
            <p className="mt-1">
              Cada advogado só acessa os casos atribuídos a ele. Petições e dossiês ficam
              restritos à sua conta e ao escritório.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Ainda com dúvidas?</p>
            <p className="mt-1">
              Escreva para{" "}
              <a href="mailto:suporte@jurisoffice.com.br" className="text-navy hover:underline">
                suporte@jurisoffice.com.br
              </a>
              .
            </p>
          </div>
        </div>
      </details>
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
