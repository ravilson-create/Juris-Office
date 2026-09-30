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
  const field = "rounded border border-line p-3 w-full";
  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <p className="font-semibold text-teal-strong">Júris Office · Área profissional</p>
      <h1 className="mt-3 text-3xl">
        {signup ? "Cadastro de advogado" : "Entrar na área profissional"}
      </h1>
      <p className="mt-3 text-muted">
        Use e-mail e senha. Não é necessário confirmar um código por e-mail.
      </p>
      <form action={action} className="mt-8 flex flex-col gap-5">
        {signup && (
          <label>
            Nome completo
            <input className={field} name="name" autoComplete="name" required maxLength={120} />
          </label>
        )}
        <label>
          E-mail
          <input className={field} name="email" type="email" autoComplete="email" required />
        </label>
        {signup && (
          <>
            <label>
              CPF ou CNPJ do responsável
              <input className={field} name="cpfCnpj" inputMode="numeric" required maxLength={18} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>
                Número da OAB
                <input className={field} name="oabNumber" required maxLength={10} />
              </label>
              <label>
                UF da OAB
                <select className={field} name="oabState" required defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {"AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO"
                    .split(" ")
                    .map((uf) => (
                      <option key={uf}>{uf}</option>
                    ))}
                </select>
              </label>
            </div>
            <label>
              Plano
              <select className={field} name="plan">
                <option value="monthly">Mensal · R$ 39,90</option>
                <option value="yearly">Anual · R$ 300,00</option>
              </select>
            </label>
          </>
        )}
        <label>
          Senha
          <input
            className={field}
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        {signup && (
          <>
            <label>
              Confirmar senha
              <input
                className={field}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </label>
            <label className="flex gap-3">
              <input type="checkbox" name="terms" required />
              <span>
                Aceito os{" "}
                <Link className="underline" href="/termos">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link className="underline" href="/privacidade">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>
            <p className="text-sm text-muted">
              Cobrança em ambiente de testes Asaas. O cadastro permite entrar na conta; os casos
              exigem assinatura ativa.
            </p>
          </>
        )}
        {state?.error && (
          <p role="alert" className="text-red-700">
            {state.error}
          </p>
        )}
        <button className="rounded bg-navy p-3 text-white" disabled={pending}>
          {pending ? "Aguarde…" : signup ? "Criar conta e escolher pagamento" : "Entrar"}
        </button>
      </form>
      <p className="mt-6">
        <Link className="underline" href={signup ? "/auth/sign-in" : "/auth/sign-up"}>
          {signup ? "Já tem conta? Entrar" : "Criar conta de advogado"}
        </Link>
      </p>
      <p className="mt-4">
        <Link className="underline" href="/atendimento">
          Sou cliente: iniciar atendimento gratuito
        </Link>
      </p>
      <p className="mt-3">
        <Link className="underline" href="/consulta">
          Consultar atendimento por protocolo
        </Link>
      </p>
    </main>
  );
}
