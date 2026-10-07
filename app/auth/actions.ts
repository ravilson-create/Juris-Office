"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { claimLegacyCases } from "@/lib/auth/case-access";
import { currentUserId } from "@/lib/auth/session";
import { getDb, hasDatabase } from "@/lib/db/connection";

export type AuthState = { error?: string; message?: string } | null;

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});

/**
 * "Entrar" no cabeçalho é o login da área profissional (advogado/admin/administrativo) — um
 * cidadão nunca precisa de conta, só o cookie de sessão anônimo. Por isso, depois de autenticar,
 * manda quem tem papel de equipe para "/equipe" (o sistema da assinatura) e só cai em
 * "/atendimento/meus" quem logar sem fazer parte de nenhum escritório.
 */
async function destinoPosLogin(): Promise<string> {
  if (!hasDatabase()) return "/atendimento/meus";
  const actor = await currentUserId();
  if (!actor) return "/atendimento/meus";
  const rows = await getDb().query<{ role: string }>("SELECT role FROM profiles WHERE user_id = $1", [
    actor,
  ]);
  return rows[0] && ["lawyer", "admin", "staff"].includes(rows[0].role) ? "/equipe" : "/atendimento/meus";
}

export async function signIn(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { error: "Informe um e-mail e senha válidos." };
  const { error } = await getAuth().signIn.email(input.data);
  if (error) return { error: "Não foi possível entrar. Confira suas credenciais." };
  await claimLegacyCases();
  redirect(await destinoPosLogin());
}

export async function signUp(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = credentials.extend({ name: z.string().trim().min(2).max(120) }).safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!input.success) return { error: "Confira nome, e-mail e senha (mínimo de 12 caracteres)." };
  const { error } = await getAuth().signUp.email(input.data);
  if (error) return { error: "Não foi possível criar a conta. Tente novamente." };
  redirect("/auth/verify");
}

export async function verifyEmail(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = z
    .object({
      email: z.email().max(254),
      otp: z.string().trim().min(4).max(12),
    })
    .safeParse({ email: form.get("email"), otp: form.get("otp") });
  if (!input.success) return { error: "Informe o e-mail e o código recebidos." };
  const { error } = await getAuth().emailOtp.verifyEmail(input.data);
  if (error) return { error: "Código inválido ou expirado. Confira o e-mail e tente novamente." };
  redirect("/auth/sign-in?verified=1");
}

export async function resendVerification(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const { error } = await getAuth().emailOtp.sendVerificationOtp({
    email: email.data,
    type: "email-verification",
  });
  if (error) return { error: "Não foi possível enviar outro código. Tente mais tarde." };
  return { message: "Se a conta existir, um novo código foi enviado." };
}

export async function requestPasswordReset(_state: AuthState, form: FormData): Promise<AuthState> {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "https://juris-office-eta.vercel.app";
  const { error } = await getAuth().requestPasswordReset({
    email: email.data,
    redirectTo: `${new URL(appOrigin).origin}/auth/reset-password`,
  });
  if (error) return { error: "Não foi possível iniciar a redefinição de senha. Tente novamente." };
  return { message: "Se a conta existir, enviaremos as instruções de redefinição para o e-mail informado." };
}

export async function resetPassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = z.object({
    token: z.string().min(1),
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  }).safeParse({
    token: form.get("token"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!input.success || input.data.password !== input.data.confirmPassword) {
    return { error: "Informe duas vezes a nova senha, com no mínimo 12 caracteres." };
  }
  const { error } = await getAuth().resetPassword({
    newPassword: input.data.password,
    token: input.data.token,
  });
  if (error) return { error: "O link é inválido ou expirou. Solicite uma nova redefinição." };
  redirect("/auth/sign-in?password_reset=1");
}

export async function signOut() {
  await getAuth().signOut();
  redirect("/");
}
