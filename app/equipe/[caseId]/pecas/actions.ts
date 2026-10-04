"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { gerarPeca } from "@/lib/pecas/gerar";
import { CAMPOS_PECA, TITULO_PECA, tipoPecaSchema } from "@/domain/pecas/schema";
import { gerarAuxilioCampoPeca } from "@/lib/ai/auxiliar-campo-peca";

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
    {
      applicant: ctx.legalCase.applicant,
      protocolo: ctx.legalCase.protocol,
      numeroProcesso,
      areaSlug: ctx.area.slug,
    },
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

/**
 * Auxílio de IA para PREENCHER um campo livre do formulário, antes de gerar a peça — diferente
 * de corrigirSecaoIAAction (peticao/actions.ts), que corrige a redação de uma seção DEPOIS de
 * gerada. Nunca para a petição inicial (não tem campo livre). Mesma cota mensal compartilhada
 * (consumir_auxilio_ia, migração 0025/0030).
 */
export async function auxiliarCampoPecaAction(input: {
  tipo: string;
  chave: string;
  nota: string;
}): Promise<{ sugestao?: string; error?: string }> {
  const actor = await currentUserId();
  if (!actor) return { error: "Não autenticado." };

  const tipo = tipoPecaSchema.safeParse(input.tipo);
  if (!tipo.success) return { error: "Tipo de peça inválido." };
  const campo = CAMPOS_PECA[tipo.data].find((c) => c.chave === input.chave);
  if (!campo) return { error: "Campo inválido." };
  const nota = input.nota.trim();
  if (!nota) return { error: "Escreva uma anotação antes de pedir auxílio da IA." };

  const db = getDb();
  const [{ permitido }] = await db.query<{ permitido: boolean }>(
    "SELECT consumir_auxilio_ia() AS permitido",
  );
  if (!permitido) {
    return {
      error: "Limite de 100 auxílios de IA deste mês já foi atingido. Volta a liberar no mês seguinte.",
    };
  }

  try {
    const { textoAuxiliado } = await gerarAuxilioCampoPeca({
      tituloPeca: TITULO_PECA[tipo.data],
      rotuloCampo: campo.rotulo,
      notaAdvogado: nota,
    });
    return { sugestao: textoAuxiliado };
  } catch {
    return { error: "Não foi possível auxiliar agora. Tente novamente em instantes." };
  }
}
