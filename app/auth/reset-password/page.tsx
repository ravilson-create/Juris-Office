import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token || error) return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-3xl">Link inválido ou expirado</h1>
      <p className="mt-3 text-muted">Solicite uma nova redefinição de senha.</p>
      <p className="mt-6"><Link className="underline" href="/auth/forgot-password">Solicitar novo link</Link></p>
    </main>
  );
  return <main className="mx-auto max-w-md px-5 py-12"><h1 className="text-3xl">Criar nova senha</h1><p className="mt-3 text-muted">Use pelo menos 12 caracteres.</p><ResetPasswordForm token={token} /></main>;
}
