import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-3xl">Redefinir senha</h1>
      <p className="mt-3 text-muted">Informe o e-mail da conta. Enviaremos um link seguro para criar uma nova senha.</p>
      <ForgotPasswordForm initialEmail={email ?? ""} />
      <p className="mt-6"><Link className="underline" href="/auth/sign-in">Voltar para entrar</Link></p>
    </main>
  );
}
