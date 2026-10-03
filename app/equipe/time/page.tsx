import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { ConviteForm } from "@/components/equipe/convite-form";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { listarConvitesPendentes, listarEquipe, type MembroEquipeRow } from "@/lib/services/equipe-time";
import {
  cancelarConviteAction,
  promoverAdminAction,
  rebaixarAdvogadoAction,
  removerDaEquipeAction,
  revogarOabAction,
} from "../actions";

const ROTULO_PAPEL: Record<MembroEquipeRow["role"], string> = {
  admin: "Administrador",
  lawyer: "Advogado",
  staff: "Administrativo",
};

/** OAB sai autodeclarada no cadastro (migração 0020) — "oab_verificado_por = user_id" é a própria
 * pessoa confirmando a si mesma, nunca um humano de verdade checando. */
function statusOab(m: MembroEquipeRow): string {
  if (!m.oab_numero) return "Sem OAB cadastrada";
  const base = `OAB ${m.oab_numero}/${m.oab_uf}`;
  if (!m.oab_verificado_em) return `${base} — aguardando confirmação`;
  if (m.oab_verificado_por === m.user_id) return `${base} — autodeclarada (não conferida)`;
  return `${base} — confirmada por administrador`;
}

export const dynamic = "force-dynamic";

const MENSAGEM_ERRO: Record<string, string> = {
  equipe_ultimo_admin: "O escritório precisa manter ao menos um administrador.",
  convite_dados: "Revise os dados do convite — e-mail e CPF precisam ser válidos.",
  convite_oab_obrigatoria: "Convite de advogado exige número e UF da OAB.",
  convite_limite: "O escritório já tem 5 funcionários (contando convites pendentes).",
  convite_falhou: "Não foi possível enviar o convite.",
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
  const convites = await listarConvitesPendentes(db, profile[0].office_id);
  const totalAdmins = equipe.filter((m) => m.role === "admin").length;
  // Mesma conta de convidar_membro_equipe: o admin dono não ocupa uma das 5 vagas, só
  // advogados/administrativos já na equipe mais convites ainda pendentes.
  const vagasOcupadas =
    equipe.filter((m) => m.role === "lawyer" || m.role === "staff").length + convites.length;

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
                    {ROTULO_PAPEL[membro.role]}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {statusOab(membro)}
                  {membro.subscription_status && ` · Assinatura: ${membro.subscription_status}`}
                </p>
              </div>
              <div className="flex gap-2">
                {membro.oab_verificado_em && membro.oab_verificado_por === membro.user_id && (
                  <form action={revogarOabAction}>
                    <input type="hidden" name="userId" value={membro.user_id} />
                    <button className="rounded border border-line px-3 py-2 text-sm">
                      Revogar OAB
                    </button>
                  </form>
                )}
                {membro.role === "lawyer" && (
                  <form action={promoverAdminAction}>
                    <input type="hidden" name="userId" value={membro.user_id} />
                    <button className="rounded border border-line px-3 py-2 text-sm">
                      Promover a admin
                    </button>
                  </form>
                )}
                {membro.role === "admin" && (
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

      {convites.length > 0 && (
        <>
          <h2 className="mt-10 text-xl">Convites pendentes</h2>
          <ul className="mt-4 space-y-3">
            {convites.map((convite) => (
              <li
                key={convite.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-line p-4"
              >
                <div>
                  <p className="font-semibold">
                    {convite.email}{" "}
                    <span className="rounded bg-navy-soft px-2 py-0.5 text-xs text-navy-strong">
                      {convite.role === "lawyer" ? "Advogado" : "Administrativo"}
                    </span>
                  </p>
                  {convite.role === "lawyer" && (
                    <p className="mt-1 text-sm text-muted">
                      OAB {convite.oab_numero}/{convite.oab_uf}
                    </p>
                  )}
                </div>
                <form action={cancelarConviteAction}>
                  <input type="hidden" name="inviteId" value={convite.id} />
                  <button className="rounded border border-danger px-3 py-2 text-sm text-danger">
                    Cancelar convite
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mt-10 text-xl">Convidar membro</h2>
      <p className="mt-2 text-muted">
        {vagasOcupadas} de 5 vagas usadas (equipe atual + convites pendentes). A pessoa convidada
        entra assim que logar com esse e-mail.
      </p>
      {vagasOcupadas >= 5 ? (
        <p className="mt-4 text-sm text-muted">
          O escritório já tem 5 funcionários — remova alguém ou cancele um convite para liberar
          uma vaga.
        </p>
      ) : (
        <ConviteForm />
      )}
    </main>
  );
}
