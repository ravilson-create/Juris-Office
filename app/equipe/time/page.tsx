import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { listarEquipe } from "@/lib/services/equipe-time";
import { promoverAdminAction, rebaixarAdvogadoAction, removerDaEquipeAction } from "../actions";

export const dynamic = "force-dynamic";

const MENSAGEM_ERRO: Record<string, string> = {
  equipe_ultimo_admin: "O escritório precisa manter ao menos um administrador.",
};

export default async function GestaoEquipePage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const profile = await db.query<{ role: string; office_id: string }>(
    "SELECT role, office_id FROM profiles WHERE user_id = $1",
    [actor],
  );
  if (profile[0]?.role !== "admin") redirect("/equipe");

  const { erro } = await searchParams;
  const equipe = await listarEquipe(db, profile[0].office_id);
  const totalAdmins = equipe.filter((m) => m.role === "admin").length;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p>
        <Link href="/equipe">Voltar</Link>
      </p>
      <h1 className="mt-4 text-3xl">Gestão de equipe</h1>
      <p className="mt-2 text-muted">Advogados e administradores do seu escritório.</p>

      {erro && MENSAGEM_ERRO[erro] && (
        <div className="mt-6">
          <Alert tone="error" title="Não foi possível concluir.">
            {MENSAGEM_ERRO[erro]}
          </Alert>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {equipe.map((membro) => {
          const ehUltimoAdmin = membro.role === "admin" && totalAdmins <= 1;
          return (
            <li
              key={membro.user_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-line p-4"
            >
              <div>
                <p className="font-semibold">
                  {membro.email ?? membro.user_id}{" "}
                  <span className="rounded bg-navy-soft px-2 py-0.5 text-xs text-navy-strong">
                    {membro.role === "admin" ? "Administrador" : "Advogado"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {membro.oab_numero
                    ? `OAB ${membro.oab_numero}/${membro.oab_uf} — ${
                        membro.oab_verificado_em ? "confirmada" : "aguardando confirmação"
                      }`
                    : "Sem OAB cadastrada"}
                  {membro.subscription_status && ` · Assinatura: ${membro.subscription_status}`}
                </p>
              </div>
              <div className="flex gap-2">
                {membro.role === "lawyer" ? (
                  <form action={promoverAdminAction}>
                    <input type="hidden" name="userId" value={membro.user_id} />
                    <button className="rounded border border-line px-3 py-2 text-sm">
                      Promover a admin
                    </button>
                  </form>
                ) : (
                  <form action={rebaixarAdvogadoAction}>
                    <input type="hidden" name="userId" value={membro.user_id} />
                    <button
                      disabled={ehUltimoAdmin}
                      title={ehUltimoAdmin ? "É o único administrador do escritório" : undefined}
                      className="rounded border border-line px-3 py-2 text-sm disabled:opacity-40"
                    >
                      Rebaixar a advogado
                    </button>
                  </form>
                )}
                <form action={removerDaEquipeAction}>
                  <input type="hidden" name="userId" value={membro.user_id} />
                  <button
                    disabled={ehUltimoAdmin}
                    title={ehUltimoAdmin ? "É o único administrador do escritório" : undefined}
                    className="rounded border border-danger px-3 py-2 text-sm text-danger disabled:opacity-40"
                  >
                    Remover da equipe
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
      {equipe.length === 0 && <p className="mt-6 text-muted">Nenhum membro de equipe ainda.</p>}
    </main>
  );
}
