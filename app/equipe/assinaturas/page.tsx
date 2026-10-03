import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentIdentity } from "@/lib/auth/session";
import { isAppOwner } from "@/lib/auth/bootstrap-admin";
import { getMaintenanceDb, hasDatabase } from "@/lib/db/connection";
import { listarAssinaturasAtivas } from "@/lib/services/equipe-contratos";
import { formatCents } from "@/domain/triage/money";
import { formatInstantDateTime } from "@/domain/time";

export const metadata: Metadata = { title: "Assinaturas" };
export const dynamic = "force-dynamic";

const ROTULO_PAPEL: Record<"lawyer" | "client", string> = {
  lawyer: "Advogado (CONTRATADO)",
  client: "Cliente (CONTRATANTE)",
};
const ROTULO_HONORARIO: Record<string, string> = {
  fixed: "Valor fixo",
  success: "Honorário de êxito",
  hourly: "Por hora",
  mixed: "Misto (fixo + êxito)",
};

/**
 * Aba exclusiva do administrador do aplicativo (lib/auth/bootstrap-admin.ts#isAppOwner) — não do
 * admin de um escritório. Mostra toda assinatura de todo contrato já efetivado (status
 * "Assinado") em qualquer escritório da plataforma, fora da regra normal de isolamento por
 * escritório — daí o getMaintenanceDb() (ignora RLS) em vez do getDb() comum.
 */
export default async function AssinaturasPage() {
  const identity = await currentIdentity();
  if (!identity || !isAppOwner(identity)) notFound();

  if (!hasDatabase()) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-3xl">Assinaturas ativas</h1>
        <p className="mt-4 text-muted">Indisponível nesta instalação.</p>
      </main>
    );
  }

  const db = getMaintenanceDb();
  let linhas;
  try {
    linhas = await listarAssinaturasAtivas(db);
  } finally {
    await db.close();
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl">Assinaturas ativas</h1>
      <p className="mt-2 max-w-prose text-muted">
        Toda assinatura de todo contrato já efetivado (status &ldquo;Assinado&rdquo;), de todos os
        escritórios da plataforma — visão exclusiva do administrador do aplicativo, fora da regra
        normal de isolamento por escritório.
      </p>

      {linhas.length === 0 ? (
        <p className="mt-8 text-muted">Nenhuma assinatura registrada ainda.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-4 font-medium">Protocolo</th>
                <th className="py-2 pr-4 font-medium">Escritório</th>
                <th className="py-2 pr-4 font-medium">Assinante</th>
                <th className="py-2 pr-4 font-medium">Honorário</th>
                <th className="py-2 pr-4 font-medium">Assinado em</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-line">
                  <td className="py-2 pr-4 tabular-nums">{l.protocol}</td>
                  <td className="py-2 pr-4">{l.office_name ?? "—"}</td>
                  <td className="py-2 pr-4">{ROTULO_PAPEL[l.signer_role]}</td>
                  <td className="py-2 pr-4">
                    {ROTULO_HONORARIO[l.fee_type]} · {formatCents(Number(l.fee_value_cents))}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{formatInstantDateTime(l.signed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
