"use client";
import { useActionState } from "react";
import { consult, type ConsultState } from "./actions";
import { CASE_STATUS_LABEL } from "@/domain/case/status";
import type { CaseStatus } from "@/domain/case/schema";
export function ConsultForm() {
  const [state, action, pending] = useActionState<ConsultState, FormData>(consult, null);
  return (
    <>
      <form action={action} className="mt-6 space-y-4">
        <label className="block">
          Número do protocolo
          <input
            className="mt-2 w-full rounded border p-3 font-mono"
            name="token"
            required
            autoComplete="off"
            spellCheck={false}
            maxLength={64}
          />
        </label>
        <button className="rounded bg-navy px-5 py-3 text-white" disabled={pending}>
          {pending ? "Consultando…" : "Consultar andamento"}
        </button>
      </form>
      {state?.error && (
        <p className="mt-5 text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state?.result && (
        <section className="mt-8 rounded border border-line p-6" aria-live="polite">
          <h2 className="break-all text-xl">{state.result.protocol}</h2>
          <p className="mt-3 text-lg font-semibold">
            {CASE_STATUS_LABEL[state.result.status as CaseStatus] ?? state.result.status}
          </p>
          <p className="mt-2 text-sm">
            Atualizado em {new Date(state.result.updatedAt).toLocaleString("pt-BR")}
          </p>
          <h3 className="mt-6 font-semibold">Histórico de acompanhamento</h3>
          <ul className="mt-4 space-y-4">
            {state.result.updates.map((u, i) => (
              <li key={i} className="border-l-2 border-teal pl-4">
                <p className="font-medium">
                  {CASE_STATUS_LABEL[u.status as CaseStatus] ?? u.status}
                </p>
                {u.message && <p className="whitespace-pre-wrap">{u.message}</p>}
                <p className="text-sm text-muted">{new Date(u.at).toLocaleString("pt-BR")}</p>
              </li>
            ))}
          </ul>
          {!state.result.updates.length && (
            <p className="mt-3">Solicitação recebida. Aguardando análise e encaminhamento.</p>
          )}
        </section>
      )}
    </>
  );
}
