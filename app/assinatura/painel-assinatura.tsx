"use client";

import { useState, useTransition } from "react";
import { subscriptionPlans, formatPlanPrice } from "@/lib/billing/plans";
import { buscarLinkPagamento, cancelarAssinatura, trocarPlano, type Assinatura } from "./actions";

const ROTULO_STATUS: Record<string, string> = {
  trial: "Em teste grátis",
  active: "Ativa",
  past_due: "Pagamento em atraso",
  canceled: "Cancelada",
};

export function PainelAssinatura({ assinatura }: { assinatura: Assinatura }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const executar = (acao: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await acao();
      if (result.error) setError(result.error);
    });
  };

  const validaAte = new Date(assinatura.valid_until).toLocaleDateString("pt-BR", {
    timeZone: "America/Fortaleza",
  });

  const planoAtual = subscriptionPlans.find((plan) => plan.id === assinatura.plano_id);\n  const podeMigrarParaAnual = assinatura.plano_id === "monthly" && !assinatura.cancelar_em_renovacao;\n\n  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="font-semibold">Plano atual: {planoAtual?.label ?? "Não identificado"}</p>\n        {planoAtual && (\n          <p className="mt-1 text-lg font-semibold">\n            {formatPlanPrice(planoAtual.amountCents)}/{planoAtual.interval}\n          </p>\n        )}\n        <p className="mt-2 text-sm font-medium">{ROTULO_STATUS[assinatura.status] ?? assinatura.status}</p>
        <p className="mt-1 text-sm text-muted">
          {assinatura.status === "trial" ? "Teste grátis até" : "Válida até"} {validaAte}
          {assinatura.cancelar_em_renovacao ? " · cancelamento programado" : " · renovação automática"}
        </p>
      </div>

      {assinatura.cancelar_em_renovacao && (\n        <div className="rounded-xl border border-line bg-surface p-5">\n          <h2 className="text-xl">Cancelamento programado</h2>\n          <p className="mt-2 text-sm text-muted">\n            Sua assinatura não será renovada. Você continuará com acesso ao Júris Office até {validaAte}.\n          </p>\n        </div>\n      )}\n\n      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}

      {assinatura.invoice_url ? (
        <a
          href={assinatura.invoice_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded bg-navy px-4 py-2 text-white"
        >
          Pagar fatura
        </a>
      ) : (
        <button
          className="rounded border border-line px-4 py-2"
          disabled={pending}
          onClick={() => executar(buscarLinkPagamento)}
        >
          Buscar fatura
        </button>
      )}

      {!assinatura.cancelar_em_renovacao && (
        <section>
          <h2 className="text-xl">Trocar de plano</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {subscriptionPlans.filter((plan) => plan.id === "yearly").map((plan) => (
              <form
                key={plan.id}
                action={(form) => executar(() => trocarPlano(form))}
              >
                <input type="hidden" name="planoId" value={plan.id} />
                <button
                  className="rounded border border-line px-4 py-2 disabled:opacity-50"
                  disabled={pending || assinatura.plano_id === plan.id}
                >
                  Mudar para o plano anual — {formatPlanPrice(plan.amountCents)}/{plan.interval}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      {!assinatura.cancelar_em_renovacao && (
        <button
          className="rounded border border-danger px-4 py-2 text-sm text-danger disabled:opacity-50"
          disabled={pending}
          onClick={() => executar(cancelarAssinatura)}
        >
          Cancelar assinatura
        </button>
      )}
    </div>
  );
}
