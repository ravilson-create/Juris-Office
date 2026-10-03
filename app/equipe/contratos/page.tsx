import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { formatCents } from "@/domain/triage/money";
import { LEGAL_AREAS } from "@/lib/mocks/legal-areas";
import { listarContratosEquipe } from "@/lib/services/equipe-contratos";

export const dynamic = "force-dynamic";

const NOME_AREA = new Map(LEGAL_AREAS.map((a) => [a.id, a.name]));

const ROTULO_TIPO_HONORARIO: Record<string, string> = {
  fixed: "Valor fixo",
  success: "Honorário de êxito",
  hourly: "Por hora",
  mixed: "Misto (fixo + êxito)",
};
const ROTULO_STATUS_CONTRATO: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado ao cliente",
  signed: "Assinado",
  cancelled: "Cancelado",
};

/**
 * Lista, numa aba própria, todos os contratos gerados a partir dos atendimentos — sem precisar
 * abrir caso por caso para achar um contrato específico. A política de RLS de `contracts`
 * (can_read_case) já decide o que o ator enxerga; esta página só exibe.
 */
export default async function ContratosEquipePage() {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const profile = await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = $1", [
    actor,
  ]);
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) redirect("/atendimento/meus");
  if (profile[0].role === "lawyer") {
    const acesso = await db.query<{ oab_verificado_em: Date | null }>(
      `SELECT p.oab_verificado_em FROM profiles p
       JOIN lawyer_subscriptions s ON s.lawyer_id = p.user_id
       WHERE p.user_id = $1 AND s.status IN ('active', 'trial') AND s.valid_until > now()`,
      [actor],
    );
    if (!acesso.length) redirect("/assinatura");
    if (!acesso[0].oab_verificado_em) redirect("/advogado/pendente");
  }

  const contratos = await listarContratosEquipe(db);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <h1 className="text-3xl">Contratos</h1>
      <p className="mt-2 text-muted">Contratos gerados a partir dos atendimentos.</p>

      {contratos.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3">
                  Protocolo
                </th>
                <th scope="col" className="px-4 py-3">
                  Caso
                </th>
                <th scope="col" className="px-4 py-3">
                  Área
                </th>
                <th scope="col" className="px-4 py-3">
                  Honorário
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((contrato) => (
                <tr key={contrato.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">
                    {contrato.protocol}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {contrato.title || "Caso sem título"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {NOME_AREA.get(contrato.legal_area_id) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {ROTULO_TIPO_HONORARIO[contrato.fee_type]} ·{" "}
                    {formatCents(Number(contrato.fee_value_cents))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded bg-navy-soft px-2 py-1 text-xs font-semibold text-navy-strong">
                      {ROTULO_STATUS_CONTRATO[contrato.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/equipe/${contrato.case_id}/contrato`}
                      className="font-semibold text-navy hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 text-muted">Nenhum contrato gerado ainda.</p>
      )}
    </main>
  );
}
