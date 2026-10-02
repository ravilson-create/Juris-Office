import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { listarAuditoria } from "@/lib/services/auditoria";

export const dynamic = "force-dynamic";

const ROTULO_ACAO: Record<string, string> = {
  read_case: "Consultou o caso",
  assign_lawyer: "Atribuiu advogado",
  verify_lawyer_oab: "Confirmou OAB",
  claim_legacy_case: "Vinculou atendimento anônimo à conta",
};

export default async function AuditoriaPage() {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const profile = await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = $1", [
    actor,
  ]);
  // Só admin vê a trilha consolidada — advogado vê sua própria auditoria embutida na página do
  // caso (RLS já restringe audit_read a actor_id próprio fora desse papel).
  if (!profile[0] || profile[0].role !== "admin") notFound();

  const entradas = await listarAuditoria(db);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p>
        <Link href="/equipe">Voltar</Link>
      </p>
      <h1 className="mt-4 text-3xl">Auditoria de acesso</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Quem consultou ou alterou cada caso do seu escritório, com data e hora — o lastro exigido
        pelo art. 117 da Lei 14.133 para o acesso a informação de processo.
      </p>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 pr-3">Quando</th>
            <th className="py-2 pr-3">Quem</th>
            <th className="py-2 pr-3">Ação</th>
            <th className="py-2 pr-3">Caso</th>
          </tr>
        </thead>
        <tbody>
          {entradas.map((e) => (
            <tr key={e.id} className="border-b border-line">
              <td className="py-2 pr-3 whitespace-nowrap">
                {new Date(e.occurred_at).toLocaleString("pt-BR", {
                  timeZone: "America/Fortaleza",
                })}
              </td>
              <td className="py-2 pr-3">{e.actor_id}</td>
              <td className="py-2 pr-3">{ROTULO_ACAO[e.action] ?? e.action}</td>
              <td className="py-2 pr-3">
                {e.case_id ? (
                  <Link href={`/equipe/${e.case_id}`} className="text-navy hover:underline">
                    {e.protocol ?? e.case_id}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {entradas.length === 0 && <p className="mt-6 text-muted">Nenhum registro ainda.</p>}
    </main>
  );
}
