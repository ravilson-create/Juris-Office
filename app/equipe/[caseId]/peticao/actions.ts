"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { gerarPeticao } from "@/lib/petitions/gerar";
import { listarPendencias, type PetitionSection } from "@/domain/petition/schema";

export async function gerarPeticaoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const modeloId = z.string().min(1).safeParse(form.get("modeloId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !modeloId.success) return;

  const ctx = await getCaseService().getTriageContext(caseId.data);
  if (!ctx || !ctx.legalCase.applicant) return;

  const documento = gerarPeticao(
    ctx.area.slug,
    modeloId.data,
    ctx.legalCase.applicant,
    ctx.validAnswers,
  );
  if (!documento) return;

  // A política RLS confere acesso ao caso e papel de advogado/admin — nunca confia no formulário.
  await getDb().query(
    `INSERT INTO case_petitions(id, case_id, modelo_id, titulo_modelo, secoes, pendencias, criado_por)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
    [
      randomUUID(),
      caseId.data,
      documento.modeloId,
      documento.tituloModelo,
      JSON.stringify(documento.secoes),
      JSON.stringify(documento.pendencias),
      actor,
    ],
  );
  revalidatePath(`/equipe/${caseId.data}/peticao`);
}

export async function salvarPeticaoAction(form: FormData) {
  const petitionId = z.uuid().safeParse(form.get("petitionId"));
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const chaves = z.array(z.string().min(1)).safeParse(form.getAll("chave"));
  const actor = await currentUserId();
  if (!actor || !petitionId.success || !caseId.success || !chaves.success) return;

  const db = getDb();
  const [atual] = await db.query<{ secoes: PetitionSection[] }>(
    "SELECT secoes FROM case_petitions WHERE id = $1",
    [petitionId.data],
  );
  if (!atual) return;

  const corposPorChave = new Map(
    chaves.data.map((chave) => [chave, String(form.get(`corpo:${chave}`) ?? "")]),
  );
  const secoes: PetitionSection[] = atual.secoes.map((secao) =>
    corposPorChave.has(secao.chave) ? { ...secao, corpo: corposPorChave.get(secao.chave)! } : secao,
  );

  await db.query(
    "UPDATE case_petitions SET secoes = $2::jsonb, pendencias = $3::jsonb, atualizado_em = now() WHERE id = $1",
    [petitionId.data, JSON.stringify(secoes), JSON.stringify(listarPendencias(secoes))],
  );
  revalidatePath(`/equipe/${caseId.data}/peticao`);
}
