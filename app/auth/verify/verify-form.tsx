"use client";

import { useActionState } from "react";
import { resendVerification, verifyEmail, type AuthState } from "../actions";

export function VerifyForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(verifyEmail, null);
  const [resendState, resendAction, resending] = useActionState<AuthState, FormData>(
    resendVerification,
    null,
  );
  return (
    <div className="mt-8 space-y-5">
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          E-mail
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="rounded border p-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          Código de verificação
          <input
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={4}
            maxLength={12}
            className="rounded border p-3"
          />
        </label>
        {state?.error && (
          <p role="alert" className="text-red-700">
            {state.error}
          </p>
        )}
        <button disabled={pending} className="rounded bg-navy p-3 text-white">
          {pending ? "Verificando…" : "Confirmar e-mail"}
        </button>
      </form>
      <form action={resendAction} className="space-y-3 border-t border-line pt-5">
        <label className="flex flex-col gap-1">
          Não recebeu o código? Informe seu e-mail novamente
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="rounded border p-3"
          />
        </label>
        {(resendState?.error || resendState?.message) && (
          <p role="status">{resendState.error || resendState.message}</p>
        )}
        <button disabled={resending} className="rounded border border-line p-3">
          {resending ? "Enviando…" : "Reenviar código"}
        </button>
      </form>
    </div>
  );
}
