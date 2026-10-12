"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthState } from "../actions";

export function ForgotPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        E-mail
        <input className="rounded border p-3" name="email" type="email" autoComplete="email" defaultValue={initialEmail} required />
      </label>
      {state?.error && <p role="alert" className="text-red-700">{state.error}</p>}
      {state?.message && <p role="status" className="text-green-700">{state.message}</p>}
      <button className="rounded bg-navy p-3 text-white" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link de redefinição"}
      </button>
    </form>
  );
}
