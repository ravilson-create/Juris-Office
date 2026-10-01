import { redirect } from "next/navigation";
import { authEnabled, currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { CadastroForm } from "./cadastro-form";

export const dynamic = "force-dynamic";

export default async function CadastroAdvogadoPage() {
  if (!authEnabled) redirect("/advogado");
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");

  const profile = await getDb().query<{ office_id: string | null }>(
    "SELECT office_id FROM profiles WHERE user_id = $1",
    [actor],
  );
  if (profile[0]?.office_id) redirect("/assinatura");

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-3xl">Cadastro profissional</h1>
      <p className="mt-3 text-muted">
        Crie o escritório, escolha um plano e comece a usar — 7 dias grátis, sem cartão.
      </p>
      <CadastroForm />
    </main>
  );
}
