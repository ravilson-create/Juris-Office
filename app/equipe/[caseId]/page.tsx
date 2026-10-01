import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DossierView } from "@/components/dossier/dossier-view";
import { PrintButton } from "@/components/dossier/print-button";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { addCaseNote } from "../actions";

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
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex justify-between print:hidden">
        <Link href="/equipe">Voltar</Link>
        <PrintButton />
      </div>
      <DossierView dossier={submission.dossier} />
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
