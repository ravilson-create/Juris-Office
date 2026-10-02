import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { peticaoParaPdfBuffer } from "@/lib/petitions/pdf";
import type { PetitionDocument } from "@/domain/petition/schema";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  // A política RLS do caso (via case_petitions) garante que só advogado/admin com acesso ao
  // caso chegue até aqui — a mesma trava usada para ler/editar a petição na tela e para o .docx.
  const [row] = await getDb().query<{
    modelo_id: string;
    titulo_modelo: string;
    secoes: PetitionDocument["secoes"];
    pendencias: string[];
  }>("SELECT modelo_id, titulo_modelo, secoes, pendencias FROM case_petitions WHERE id = $1", [id]);
  if (!row) notFound();

  const buffer = await peticaoParaPdfBuffer({
    modeloId: row.modelo_id,
    tituloModelo: row.titulo_modelo,
    secoes: row.secoes,
    pendencias: row.pendencias,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${row.titulo_modelo.replace(/[^\w\- ]/g, "")}.pdf"`,
    },
  });
}
