"use client";
import { useActionState, type ReactNode } from "react";
import { financialAction } from "./actions";

export const fieldClass = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm";
export function FinancialForm({ children, label }: { children: ReactNode; label: string }) {
  const [state, action, pending] = useActionState(financialAction, { ok: false, message: "" });
  return (
    <form action={action} className="space-y-3">
      {children}
      <button
        disabled={pending}
        className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Salvando…" : label}
      </button>
      {state.message && (
        <p role="status" className={state.ok ? "text-sm text-teal-strong" : "text-sm text-danger"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
export function PrintReport() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-line px-4 py-2 text-sm print:hidden"
    >
      Imprimir / salvar PDF
    </button>
  );
}
