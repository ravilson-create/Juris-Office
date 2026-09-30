"use client";
import { useActionState } from "react";
import { updateCaseStatus, type UpdateState } from "./actions";
import { CASE_STATUS_LABEL, canTransition } from "@/domain/case/status";
import type { CaseStatus } from "@/domain/case/schema";
export function StatusForm({ caseId, status }: { caseId: string; status: CaseStatus }) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateCaseStatus, null);
  const options = (Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).filter((s) =>
    canTransition(status, s),
  );
  return (
    <section className="mt-8 rounded border border-line p-5 print:hidden">
      <h2 className="text-2xl">Atualizar andamento</h2>
      <p className="mt-2 text-muted">
        Estas informações serão visíveis ao cliente na consulta pelo protocolo.
      </p>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="caseId" value={caseId} />
        <label className="block">
          Situação
          <select
            key={status}
            className="mt-2 block w-full rounded border p-3"
            name="status"
            defaultValue={status}
          >
            {options.map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Mensagem para o cliente (opcional)
          <textarea
            name="message"
            className="mt-2 block w-full rounded border p-3"
            maxLength={2000}
            rows={3}
          />
        </label>
        <button disabled={pending} className="rounded bg-navy px-5 py-3 text-white">
          {pending ? "Salvando…" : "Publicar andamento"}
        </button>
        {state?.error && (
          <p role="alert" className="text-red-700">
            {state.error}
          </p>
        )}
        {state?.message && <p role="status">{state.message}</p>}
      </form>
    </section>
  );
}
