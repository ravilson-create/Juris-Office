import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { currentUserId } from "@/lib/auth/session";
import { verificarMfaAction } from "../actions";

export const metadata: Metadata = { title: "Confirme sua identidade" };
export const dynamic = "force-dynamic";

const MENSAGEM_ERRO: Record<string, string> = {
  codigo_invalido: "Código incorreto. Confira o aplicativo autenticador e tente de novo.",
  limite: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
};

export default async function VerificarMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { erro } = await searchParams;

  return (
    <main className="mx-auto max-w-sm px-5 py-10">
      <h1 className="text-3xl">Confirme sua identidade</h1>
      <p className="mt-2 text-sm text-muted">
        Digite o código de 6 dígitos do seu aplicativo autenticador, ou um código de backup.
      </p>

      {erro && MENSAGEM_ERRO[erro] && (
        <div className="mt-6">
          <Alert tone="error" title="Não foi possível confirmar.">
            {MENSAGEM_ERRO[erro]}
          </Alert>
        </div>
      )}

      <form action={verificarMfaAction} className="mt-6 flex flex-col gap-3">
        <label htmlFor="codigo" className="block text-sm font-medium">
          Código
        </label>
        <input
          id="codigo"
          name="codigo"
          required
          autoComplete="one-time-code"
          autoFocus
          className="rounded border border-line p-2 text-center font-mono text-lg tracking-widest"
        />
        <button className="rounded bg-navy px-4 py-2 text-white">Confirmar</button>
      </form>
    </main>
  );
}
