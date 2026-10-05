import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentIdentity } from "@/lib/auth/session";
import { isAppOwner } from "@/lib/auth/bootstrap-admin";
import { getMaintenanceDb, hasDatabase } from "@/lib/db/connection";
import { listarAssinaturasAdvogados } from "@/lib/services/equipe-assinaturas";
import { formatInstantDate } from "@/domain/time";
import { definirStatusAssinaturaAction } from "./actions";

export const metadata: Metadata = { title: "Assinaturas de advogados" };
export const dynamic = "force-dynamic";

const ROTULO_STATUS: Record<string, string> = {
  trial: "Em teste grátis",
  active: "Ativa",
  past_due: "Pagamento em atraso",
  canceled: "Cancelada",
};
const COR_STATUS: Record<string, string> = {
  trial: "bg-navy-soft text-navy-strong",
  active: "bg-gold-soft text-gold-strong",
  past_due: "bg-danger-soft text-danger",
  canceled: "bg-paper text-muted",
};

/**
 * Aba exclusiva do administrador do aplicativo (lib/auth/bootstrap-admin.ts#isAppOwner) — não do
 * admin de um escritório. Mostra a assinatura (mensalidade cobrada pela Asaas) de cada advogado
 * cadastrado em qualquer escritório da plataforma, fora da regra normal de isolamento por
 * escritório — daí o getMaintenanceDb() (ignora RLS) em vez do getDb() comum.
 */
export default async function AssinaturasPage() {
  const identity = await currentIdentity();
  if (!identity || !isAppOwner(identity)) notFound();

  if (!hasDatabase()) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-3xl">Assinaturas de advogados</h1>
        <p className="mt-4 text-muted">Indisponível nesta instalação.</p>
      </main>
    );
  }

  const db = getMaintenanceDb();
  let linhas;
  try {
    linhas = await listarAssinaturasAdvogados(db);
  } finally {
    await db.close();
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-3xl">Assinaturas de advogados</h1>
      <p className="mt-2 max-w-prose text-muted">
        A mensalidade de cada advogado cadastrado (teste grátis, ativa, em atraso ou cancelada),
        de todos os escritórios da plataforma — visão exclusiva do administrador do aplicativo,
        fora da regra normal de isolamento por escritório. O status vem do webhook da Asaas; para
        um cadastro novo aparecer aqui como &ldquo;Ativa&rdquo;, a cobrança precisa ter sido
        confirmada pelo gateway.
      </p>

      {linhas.length === 0 ? (
        <p className="mt-8 text-muted">Nenhum advogado cadastrado ainda.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-2 pr-4 font-medium">E-mail</th>
                <th className="py-2 pr-4 font-medium">Escritório</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Plano</th>
                <th className="py-2 pr-4 font-medium">Válido até</th>
                <th className="py-2 pr-4 font-medium">Gateway</th>
                <th className="py-2 pr-4 font-medium">Ação manual</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.lawyer_id} className="border-b border-line">
                  <td className="py-2 pr-4">{l.email ?? "—"}</td>
                  <td className="py-2 pr-4">{l.office_name ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${COR_STATUS[l.status]}`}>
                      {ROTULO_STATUS[l.status] ?? l.status}
                    </span>
                    {l.cancelar_em_renovacao && (
                      <span className="ml-2 text-xs text-muted">(não renova)</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{l.plano_id ?? "—"}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatInstantDate(l.valid_until)}</td>
                  <td className="py-2 pr-4">
                    {l.invoice_url ? (
                      <a
                        href={l.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-navy underline"
                      >
                        {l.provider}
                      </a>
                    ) : (
                      l.provider
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <form action={definirStatusAssinaturaAction} className="inline">
                      <input type="hidden" name="lawyerId" value={l.lawyer_id} />
                      <input
                        type="hidden"
                        name="acao"
                        value={l.status === "active" ? "desativar" : "ativar"}
                      />
                      <button
                        className={`rounded border px-2 py-1 text-xs font-medium ${
                          l.status === "active"
                            ? "border-danger text-danger hover:bg-danger-soft"
                            : "border-line hover:border-navy"
                        }`}
                      >
                        {l.status === "active" ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
