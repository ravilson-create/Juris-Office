"use client";

import { useActionState } from "react";
import { resetPassword, type AuthState } from "../actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPassword, null);
  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1">Nova senha<input className="rounded border p-3" name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
      <label className="flex flex-col gap-1">Confirmar nova senha<input className="rounded border p-3" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></label>
      {state?.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <button className="rounded bg-navy p-3 text-white" disabled={pending}>{pending ? "Salvando…" : "Salvar nova senha"}</button>
    </form>
  );
}
