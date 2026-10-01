import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";

export const dynamic = "force-dynamic";

export default async function OabPendentePage() {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const profile = await getDb().query<{
    role: string;
    oab_numero: string | null;
    oab_uf: string | null;
    oab_verificado_em: Date | null;
  }>("SELECT role, oab_numero, oab_uf, oab_verificado_em FROM profiles WHERE user_id = $1", [
    actor,
  ]);
  if (profile[0]?.role !== "lawyer") redirect("/atendimento/meus");
  if (profile[0].oab_verificado_em) redirect("/equipe");

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <h1 className="text-3xl">OAB em verificação</h1>
      {profile[0].oab_numero ? (
        <p className="mt-4">
          Recebemos o cadastro da OAB {profile[0].oab_numero}/{profile[0].oab_uf}. Um
          administrador do escritório confirma manualmente o registro no site oficial da OAB antes
          de liberar o acesso a casos — isso evita que alguém sem habilitação atenda pela
          plataforma. Volte em instantes.
        </p>
      ) : (
        <p className="mt-4">
          Não encontramos o número da OAB no seu cadastro. Entre em contato com o administrador do
          escritório para corrigir.
        </p>
      )}
    </main>
  );
}
