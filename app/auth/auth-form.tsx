"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signup = mode === "sign-up";
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signup ? signUp : signIn,
    null,
  );
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-3xl">{signup ? "Criar conta" : "Entrar"}</h1>
      <form action={action} className="mt-8 flex flex-col gap-5">
        {signup && (
          <label className="flex flex-col gap-1">
            Nome
            <input
              className="rounded border p-3"
              name="name"
              autoComplete="name"
              required
              maxLength={120}
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          E-mail
          <input
            className="rounded border p-3"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          Senha
          <input
            className="rounded border p-3"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={12}
            required
          />
        </label>
        {state?.error && (
          <p role="alert" className="text-red-700">
            {state.error}
          </p>
        )}
        <button className="rounded bg-navy p-3 text-white" disabled={pending}>
          {pending ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}
        </button>
      </form>
      <p className="mt-6">
        {signup ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link className="underline" href={signup ? "/auth/sign-in" : "/auth/sign-up"}>
          {signup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </main>
  );
}
