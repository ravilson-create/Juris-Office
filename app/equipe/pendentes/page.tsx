import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { verifyLawyerOab } from "../actions";

export const dynamic = "force-dynamic";

export default async function OabPendentesPage() {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const profile = await db.query<{ role: string; office_id: string }>(
    "SELECT role, office_id FROM profiles WHERE user_id = $1",
    [actor],
  );
  if (profile[0]?.role !== "admin") redirect("/equipe");

  const pendentes = await db.query<{ user_id: string; oab_numero: string; oab_uf: string }>(
    `SELECT user_id, oab_numero, oab_uf FROM profiles
     WHERE role = 'lawyer' AND office_id = $1 AND oab_numero IS NOT NULL
       AND oab_verificado_em IS NULL
     ORDER BY user_id`,
    [profile[0].office_id],
  );

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="print:hidden">
        <Link href="/equipe">Voltar</Link>
      </p>
      <h1 className="mt-4 text-3xl">Confirmação de OAB</h1>
      <p className="mt-2 text-muted">
        Confira cada número no{" "}
        <a
          href="https://cna.oab.org.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Cadastro Nacional dos Advogados (OAB)
        </a>{" "}
        antes de confirmar — só depois disso o advogado passa a ver casos atribuídos.
      </p>
      <ul className="mt-6 space-y-4">
        {pendentes.map((p) => (
          <li
            key={p.user_id}
            className="flex items-center justify-between rounded border border-line p-4"
          >
            <span>
              OAB {p.oab_numero}/{p.oab_uf}
            </span>
            <form action={verifyLawyerOab}>
              <input type="hidden" name="lawyerId" value={p.user_id} />
              <button className="rounded bg-navy px-4 py-2 text-white">Confirmar OAB</button>
            </form>
          </li>
        ))}
      </ul>
      {pendentes.length === 0 && <p className="mt-6">Nenhuma OAB pendente de confirmação.</p>}
    </main>
  );
}
