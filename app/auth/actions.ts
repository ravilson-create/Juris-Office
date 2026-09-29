"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { claimLegacyCases } from "@/lib/auth/case-access";

export type AuthState = { error: string } | null;

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
  await claimLegacyCases();
  redirect("/atendimento/meus");
}

export async function signOut() {
  await getAuth().signOut();
  redirect("/");
}
