"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { gerarPeca } from "@/lib/pecas/gerar";
import { CAMPOS_PECA, tipoPecaSchema } from "@/domain/pecas/schema";

export async function gerarPecaAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const tipo = tipoPecaSchema.safeParse(form.get("tipo"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !tipo.success) return;

  const ctx = await getCaseService().getTriageContext(caseId.data);
  if (!ctx || !ctx.legalCase.applicant) return;

  const valores: Record<string, string> = {};
  for (const campo of CAMPOS_PECA[tipo.data]) {
    valores[campo.chave] = String(form.get(`campo:${campo.chave}`) ?? "").trim();
  }
  const numeroProcesso = String(form.get("numeroProcesso") ?? "").trim() || undefined;

  const documento = gerarPeca(
    tipo.data,
    { applicant: ctx.legalCase.applicant, protocolo: ctx.legalCase.protocol, numeroProcesso },
    valores,
  );

  // A política RLS confere acesso ao caso e papel de advogado/admin — nunca confia no formulário.
  await getDb().query(
    `INSERT INTO case_petitions(id, case_id, tipo, modelo_id, titulo_modelo, secoes, pendencias, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [
      randomUUID(),
      caseId.data,
      tipo.data,
      documento.modeloId,
      documento.tituloModelo,
      JSON.stringify(documento.secoes),
      JSON.stringify(documento.pendencias),
      actor,
    ],
  );
  revalidatePath(`/equipe/${caseId.data}/pecas`);
}
