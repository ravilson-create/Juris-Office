"use client";

import { useActionState } from "react";
import { DossierView } from "@/components/dossier/dossier-view";
import { PrintButton } from "@/components/dossier/print-button";
import {
  consultarAtendimentoAction,
  type ConsultaProtocoloState,
} from "@/app/atendimento/actions";

export function ConsultaProtocoloForm() {
  const [state, action, pending] = useActionState<ConsultaProtocoloState, FormData>(
    consultarAtendimentoAction,
    null,
  );

  return (
    <div className="mt-8 flex flex-col gap-8">
      <form action={action} className="flex flex-col gap-5 rounded-md border border-line bg-surface p-5 sm:p-6">
        <label className="flex flex-col gap-1">
          Protocolo
          <input
            className="rounded border p-3 uppercase"
            name="protocolo"
            placeholder="JO-20260927-K7M2QX"
            autoComplete="off"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          CPF usado na identificação
          <input
            className="rounded border p-3"
            name="cpf"
            inputMode="numeric"
            placeholder="Somente números"
            autoComplete="off"
            required
          />
        </label>
        {state?.ok === false && (
          <p role="alert" className="text-danger">
            {state.message}
          </p>
        )}
        <button className="self-start rounded bg-navy px-5 py-3 text-white" disabled={pending}>
          {pending ? "Consultando…" : "Consultar"}
        </button>
      </form>

      {state?.ok === true && (
        <div className="rounded-md border border-line bg-surface p-5 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl">Protocolo {state.resultado.protocol}</h2>
            <span className="rounded bg-navy-soft px-2 py-0.5 text-sm font-medium text-navy">
              {state.resultado.statusLabel}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">Área: {state.resultado.areaName}</p>

          {state.resultado.finalized && state.resultado.dossier ? (
            <>
              <div className="mt-6 flex justify-end print:hidden">
                <PrintButton />
              </div>
              <div className="mt-4 border-t border-line pt-6 print:border-0 print:pt-0">
                <DossierView dossier={state.resultado.dossier} />
              </div>
            </>
          ) : (
            <p className="mt-6 max-w-prose text-muted">
              Este atendimento ainda está em preenchimento. Continue pelo navegador e aparelho
              onde ele foi iniciado — essa consulta não transfere o atendimento para este
              navegador.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
