"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { subscriptionPlans, formatPlanPrice } from "@/lib/billing/plans";
import { BRAZIL_UFS } from "@/domain/case/schema";
import { iniciarTesteGratis, type CadastroState } from "./actions";

export function CadastroForm() {
  const [state, action, pending] = useActionState<CadastroState, FormData>(
    iniciarTesteGratis,
    null,
  );
  const planoNaUrl = useSearchParams().get("plano");
  const planoInicial = subscriptionPlans.some((p) => p.id === planoNaUrl)
    ? planoNaUrl
    : subscriptionPlans[0].id;
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
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          Número da OAB
          <input
            className="rounded border p-3"
            name="oabNumero"
            inputMode="numeric"
            required
            placeholder="Somente números"
          />
        </label>
        <label className="flex flex-col gap-1">
          UF
          <select name="oabUf" required defaultValue="" className="rounded border p-3">
            <option value="" disabled>
              —
            </option>
            {BRAZIL_UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="-mt-3 text-sm text-muted">
        A OAB é conferida manualmente contra o cadastro oficial antes de liberar o acesso a casos.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Plano</legend>
        {subscriptionPlans.map((plan) => (
          <label key={plan.id} className="flex items-center gap-2 rounded border border-line p-3">
            <input
              type="radio"
              name="planoId"
              value={plan.id}
              defaultChecked={plan.id === planoInicial}
              required
            />
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
