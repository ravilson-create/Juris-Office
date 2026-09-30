"use client";
import { useActionState } from "react";
import { billingAction, type BillingState } from "./actions";
export function BillingForm({
  configured,
  subscriptionId,
  canceled,
  plan,
}: {
  configured: boolean;
  subscriptionId?: string | null;
  canceled?: boolean;
  plan: string;
}) {
  const [state, action, pending] = useActionState<BillingState, FormData>(billingAction, null);
  return (
    <div className="mt-6 space-y-5">
      <form action={action} className="flex flex-wrap gap-3">
        <input type="hidden" name="action" value={subscriptionId ? "refresh" : "create"} />
        {!subscriptionId && (
          <label>
            Plano
            <select name="plan" defaultValue={plan} className="ml-3 rounded border p-3">
              <option value="monthly">Mensal · R$ 39,90</option>
              <option value="yearly">Anual · R$ 300,00</option>
            </select>
          </label>
        )}
        <button
          disabled={pending || !configured}
          className="rounded bg-navy px-5 py-3 text-white disabled:opacity-50"
        >
          {pending
            ? "Aguarde…"
            : subscriptionId
              ? "Atualizar situação do pagamento"
              : "Gerar cobrança de teste"}
        </button>
      </form>
      {subscriptionId && !canceled && (
        <form action={action} className="space-y-3 border-t pt-5">
          <input type="hidden" name="action" value="cancel" />
          <label className="flex gap-3">
            <input type="checkbox" name="confirm" required />
            Confirmo que desejo interromper as próximas renovações.
          </label>
          <button disabled={pending || !configured} className="rounded border p-3">
            Cancelar renovação
          </button>
          <p className="text-sm text-muted">O acesso permanece até o fim do período pago.</p>
        </form>
      )}
      {state?.error && (
        <p role="alert" className="text-red-700">
          {state.error}
        </p>
      )}
      {state?.message && <p role="status">{state.message}</p>}
    </div>
  );
}
export function CompleteProfile({ name }: { name: string }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(billingAction, null);
  return (
    <form action={action} className="mt-6 grid gap-4 rounded border p-5">
      <h2 className="text-xl">Complete seu cadastro profissional</h2>
      <input type="hidden" name="action" value="profile" />
      <input type="hidden" name="plan" value="monthly" />
      <label>
        Nome
        <input
          className="block w-full rounded border p-3"
          name="name"
          defaultValue={name}
          required
        />
      </label>
      <label>
        CPF/CNPJ
        <input className="block w-full rounded border p-3" name="cpfCnpj" required />
      </label>
      <label>
        OAB
        <input className="block w-full rounded border p-3" name="oabNumber" required />
      </label>
      <label>
        UF
        <select className="block w-full rounded border p-3" name="oabState">
          {"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
            .split(" ")
            .map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
        </select>
      </label>
      <label>
        <input type="checkbox" name="terms" required /> Aceito os termos do ambiente de testes.
      </label>
      <button disabled={pending} className="rounded bg-navy p-3 text-white">
        Salvar cadastro
      </button>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.message && <p role="status">{state.message}</p>}
    </form>
  );
}
