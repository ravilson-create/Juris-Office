"use server";
import { redirect } from "next/navigation";
import { credentials, registration } from "@/domain/user/registration";
import { authenticate, registerAccount, endSession } from "@/lib/auth/local";
import { clientIp } from "@/lib/http/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { digest } from "@/lib/auth/password";
export type AuthState = { error?: string; message?: string } | null;
export async function signIn(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = credentials.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Informe e-mail e senha válidos (mínimo de 8 caracteres)." };
  if (
    !(await checkRateLimit(`login-ip:${await clientIp()}`, 30, 900)) ||
    !(await checkRateLimit(`login-email:${digest(input.data.email)}`, 10, 900))
  )
    return { error: "Muitas tentativas. Aguarde 15 minutos." };
  try {
    if (!(await authenticate(input.data.email, input.data.password)))
      return { error: "E-mail ou senha inválidos." };
  } catch {
    return { error: "Não foi possível entrar agora. Tente novamente em instantes." };
  }
  redirect("/equipe");
}
export async function signUp(_state: AuthState, form: FormData): Promise<AuthState> {
  const input = registration.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Confira nome, CPF/CNPJ, OAB/UF, aceite dos termos e as duas senhas (mínimo de 8 caracteres).",
    };
  if (!(await checkRateLimit(`cadastro:${await clientIp()}`, 5, 3600)))
    return { error: "Limite de cadastros atingido. Aguarde uma hora." };
  try {
    await registerAccount(input.data);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Este e-mail")) return { error: e.message };
    return {
      error: "Não foi possível criar a conta. Confira se e-mail e OAB já possuem cadastro.",
    };
  }
  redirect("/assinatura");
}
export async function signOut() {
  await endSession();
  redirect("/auth/sign-in");
}
