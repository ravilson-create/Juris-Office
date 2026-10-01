import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DossierView } from "@/components/dossier/dossier-view";
import { PrintButton } from "@/components/dossier/print-button";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { listarPrazosPorCaso } from "@/lib/services/equipe-prazos";
import { addCaseNote, concluirPrazoAction, criarPrazoAction } from "../actions";

const ROTULO_STATUS_PRAZO: Record<string, string> = {
  open: "Em aberto",
  done: "Concluído",
  missed: "Vencido",
};

export const dynamic = "force-dynamic";
export default async function CasoEquipe({ params }: { params: Promise<{ caseId: string }> }) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();
  const profile = await getDb().query<{ role: string }>(
    "SELECT role FROM profiles WHERE user_id = $1",
    [actor],
  );
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) notFound();
  if (profile[0].role === "lawyer") {
    const active = await getDb().query(
      "SELECT 1 FROM lawyer_subscriptions WHERE lawyer_id = $1 AND status IN ('active', 'trial') AND valid_until > now()",
      [actor],
    );
    if (!active.length) redirect("/assinatura");
    const oab = await getDb().query<{ oab_verificado_em: Date | null }>(
      "SELECT oab_verificado_em FROM profiles WHERE user_id = $1",
      [actor],
    );
    if (!oab[0]?.oab_verificado_em) redirect("/advogado/pendente");
  }
  // A política RLS é o filtro definitivo: IDs de outro escritório/sem atribuição retornam vazio.
  const submission = await getCaseService().getSubmission(caseId);
  if (!submission) notFound();
  const notes = await getDb().query<{
    id: string;
    body: string;
    author_id: string;
    created_at: Date;
  }>(
    "SELECT id, body, author_id, created_at FROM case_notes WHERE case_id = $1 ORDER BY created_at DESC LIMIT 100",
    [caseId],
  );
  const prazos = await listarPrazosPorCaso(getDb(), caseId);
  const hojeISO = new Date().toISOString().slice(0, 10);
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex justify-between print:hidden">
        <Link href="/equipe">Voltar</Link>
        <div className="flex gap-4">
          <Link href={`/equipe/${caseId}/peticao`} className="underline">
            Petição inicial
          </Link>
          <PrintButton />
        </div>
      </div>
      <DossierView dossier={submission.dossier} />

      <section
        className="mt-10 border-t border-line pt-6 print:hidden"
        aria-labelledby="prazos-title"
      >
        <h2 id="prazos-title" className="text-2xl">
          Prazos
        </h2>
        <form action={criarPrazoAction} className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium">
              Tipo de prazo
            </label>
            <input
              id="tipo"
              name="tipo"
              required
              maxLength={160}
              placeholder="Ex.: recurso, manifestação"
              className="mt-1 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor="dataInicio" className="block text-sm font-medium">
              Contar a partir de
            </label>
            <input
              id="dataInicio"
              name="dataInicio"
              type="date"
              defaultValue={hojeISO}
              required
              className="mt-1 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor="dias" className="block text-sm font-medium">
              Dias
            </label>
            <input
              id="dias"
              name="dias"
              type="number"
              min={1}
              max={3650}
              defaultValue={15}
              required
              className="mt-1 w-20 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor="regra" className="block text-sm font-medium">
              Contagem
            </label>
            <select id="regra" name="regra" className="mt-1 rounded border border-line p-2">
              <option value="business_days">Dias úteis</option>
              <option value="calendar_days">Dias corridos</option>
            </select>
          </div>
          <button className="rounded bg-navy px-4 py-2 text-white">Adicionar prazo</button>
        </form>
        <p className="mt-2 text-xs text-muted">
          &ldquo;Dias úteis&rdquo; pula só sábado e domingo — não conhece feriado nacional,
          estadual nem forense. Confira a data sugerida antes de confiar nela.
        </p>

        <ul className="mt-6 space-y-3">
          {prazos.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded border p-4 ${
                p.status === "missed"
                  ? "border-danger bg-danger-soft"
                  : p.status === "open" && p.due_date <= hojeISO
                    ? "border-danger"
                    : "border-line"
              }`}
            >
              <div>
                <p className="font-semibold">{p.type}</p>
                <p className="text-sm text-muted">
                  Vence em {new Date(p.due_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}{" "}
                  · {ROTULO_STATUS_PRAZO[p.status] ?? p.status}
                </p>
              </div>
              {p.status !== "done" && (
                <form action={concluirPrazoAction}>
                  <input type="hidden" name="caseId" value={caseId} />
                  <input type="hidden" name="deadlineId" value={p.id} />
                  <button className="rounded border border-line px-3 py-2 text-sm">
                    Concluir
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {prazos.length === 0 && <p className="mt-5 text-muted">Nenhum prazo registrado.</p>}
      </section>

      <section
        className="mt-10 border-t border-line pt-6 print:hidden"
        aria-labelledby="notas-title"
      >
        <h2 id="notas-title" className="text-2xl">
          Notas internas
        </h2>
        <p className="mt-2 text-sm text-muted">
          Visíveis apenas aos profissionais com acesso a este caso.
        </p>
        <form action={addCaseNote} className="mt-5 space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <label htmlFor="nota" className="block font-medium">
            Nova nota
          </label>
          <textarea
            id="nota"
            name="body"
            required
            maxLength={4000}
            rows={4}
            className="w-full rounded border border-line p-3"
          />
          <button className="rounded bg-navy px-4 py-2 text-white">Salvar nota</button>
        </form>
        <ul className="mt-6 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded border border-line p-4">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-2 text-xs text-muted">
                {note.author_id} ·{" "}
                {new Date(note.created_at).toLocaleString("pt-BR", {
                  timeZone: "America/Fortaleza",
                })}
              </p>
            </li>
          ))}
        </ul>
        {notes.length === 0 && <p className="mt-5 text-muted">Ainda não há notas neste caso.</p>}
      </section>
    </main>
  );
}
