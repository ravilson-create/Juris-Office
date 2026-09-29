"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { claimLegacyCases } from "@/lib/auth/case-access";

export type AuthState = { error?: string; message?: string } | null;

const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});

export async function signIn(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { error: "Informe um e-mail e senha válidos." };
  const { error } = await getAuth().signIn.email(input.data);
  if (error) return { error: "Não foi possível entrar. Confira suas credenciais." };
  await claimLegacyCases();
  redirect("/atendimento/meus");
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

export async function signOut() {
  await getAuth().signOut();
  redirect("/");
}
