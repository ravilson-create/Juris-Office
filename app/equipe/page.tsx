import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { assignLawyer } from "./actions";

export const dynamic = "force-dynamic";
export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const db = getDb();
  const profile = await db.query<{ role: string; office_id: string }>(
    "SELECT role, office_id FROM profiles WHERE user_id = $1",
    [actor],
  );
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) redirect("/atendimento/meus");
  if (profile[0].role === "lawyer") {
    const active = await db.query(
      "SELECT 1 FROM lawyer_subscriptions WHERE lawyer_id = $1 AND status = 'active' AND valid_until > now()",
      [actor],
    );
    if (!active.length) redirect("/assinatura");
  }
  const { busca } = await searchParams;
  const query = (busca ?? "").trim().slice(0, 80);
  const cases = await db.query<{
    id: string;
    protocol: string;
    status: string;
    title: string | null;
  }>(
    `SELECT id, protocol, status, title FROM legal_cases
     WHERE status IN ('submitted', 'under_legal_review', 'needs_information', 'accepted',
                      'rejected', 'in_negotiation', 'active', 'closed')
       AND ($1 = '' OR protocol ILIKE '%' || $1 || '%' OR title ILIKE '%' || $1 || '%')
     ORDER BY updated_at DESC LIMIT 100`,
    [query],
  );
  const lawyers =
    profile[0].role === "admin"
      ? await db.query<{ user_id: string }>(
          `SELECT p.user_id FROM profiles p JOIN lawyer_subscriptions s ON s.lawyer_id = p.user_id
           WHERE p.role = 'lawyer' AND p.office_id = $1 AND s.status = 'active'
             AND s.valid_until > now() ORDER BY p.user_id`,
          [profile[0].office_id],
        )
      : [];
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl">Área profissional</h1>
      <p className="mt-2 text-muted">
        {profile[0].role === "admin" ? "Casos do seu escritório" : "Casos atribuídos a você"}
      </p>
      <form action="/equipe" className="mt-6 flex gap-2" role="search">
        <label htmlFor="busca" className="sr-only">
          Buscar caso por protocolo ou título
        </label>
        <input
          id="busca"
          name="busca"
          type="search"
          defaultValue={query}
          placeholder="Protocolo ou título"
          className="min-w-0 flex-1 rounded border p-2"
        />
        <button className="rounded bg-navy px-4 text-white">Buscar</button>
      </form>
      <ul className="mt-8 space-y-4">
        {cases.map((item) => (
          <li key={item.id} className="rounded border p-5">
            <Link className="font-semibold underline" href={`/equipe/${item.id}`}>
              {item.protocol}
            </Link>
            <p className="text-sm">
              {item.title || "Caso sem título"} · {item.status}
            </p>
            {profile[0].role === "admin" && lawyers.length > 0 && (
              <form action={assignLawyer} className="mt-4 flex gap-2">
                <input type="hidden" name="caseId" value={item.id} />
                <label>
                  Advogado{" "}
                  <select name="lawyerId" className="rounded border p-2">
                    {lawyers.map((lawyer) => (
                      <option value={lawyer.user_id} key={lawyer.user_id}>
                        {lawyer.user_id}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="rounded bg-navy px-3 text-white">Atribuir</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {cases.length === 0 && <p className="mt-6">Nenhum caso disponível.</p>}
    </main>
  );
}
