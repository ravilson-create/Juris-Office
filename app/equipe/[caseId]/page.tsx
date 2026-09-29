import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { DossierView } from "@/components/dossier/dossier-view";
import { PrintButton } from "@/components/dossier/print-button";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";

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
  // A política RLS é o filtro definitivo: IDs de outro escritório/sem atribuição retornam vazio.
  const submission = await getCaseService().getSubmission(caseId);
  if (!submission) notFound();
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6 flex justify-between print:hidden">
        <Link href="/equipe">Voltar</Link>
        <PrintButton />
      </div>
      <DossierView dossier={submission.dossier} />
    </main>
  );
}
