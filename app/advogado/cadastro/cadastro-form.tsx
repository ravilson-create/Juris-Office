"use client";

import { useActionState } from "react";
import { subscriptionPlans, formatPlanPrice } from "@/lib/billing/plans";
import { iniciarTesteGratis, type CadastroState } from "./actions";

export function CadastroForm() {
  const [state, action, pending] = useActionState<CadastroState, FormData>(
    iniciarTesteGratis,
    null,
  );
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        Nome do escritório
        <input className="rounded border p-3" name="nome" required maxLength={120} minLength={2} />
      </label>
      <label className="flex flex-col gap-1">
        CPF ou CNPJ do responsável
        <input
          className="rounded border p-3"
          name="cpfCnpj"
          inputMode="numeric"
          required
          placeholder="Somente números"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Plano</legend>
        {subscriptionPlans.map((plan, index) => (
          <label key={plan.id} className="flex items-center gap-2 rounded border border-line p-3">
            <input type="radio" name="planoId" value={plan.id} defaultChecked={index === 0} required />
            {plan.label} — {formatPlanPrice(plan.amountCents)}/{plan.interval}
          </label>
        ))}
      </fieldset>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="aceitouTermos" required className="mt-1" />
        <span>Li e aceito os Termos de Uso e a Política de Privacidade.</span>
      </label>
      {state?.error && (
        <p role="alert" className="text-red-700">
          {state.error}
        </p>
      )}
      <button className="rounded bg-navy p-3 text-white" disabled={pending}>
        {pending ? "Aguarde…" : "Começar teste grátis de 7 dias"}
      </button>
      <p className="text-sm text-muted">
        Nenhuma cobrança agora. A fatura só é gerada perto do fim do teste grátis.
      </p>
    </form>
  );
}
