"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { gerarPeticao } from "@/lib/petitions/gerar";
import { listarPendencias, type PetitionSection } from "@/domain/petition/schema";
import { gerarCorrecaoSecao } from "@/lib/ai/corrigir-peticao";

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
  const [atual] = await db.query<{ secoes: PetitionSection[]; secoes_revisadas_ia: string[] }>(
    "SELECT secoes, secoes_revisadas_ia FROM case_petitions WHERE id = $1",
    [petitionId.data],
  );
  if (!atual) return;

  const corposPorChave = new Map(
    chaves.data.map((chave) => [chave, String(form.get(`corpo:${chave}`) ?? "")]),
  );
  const secoes: PetitionSection[] = atual.secoes.map((secao) =>
    corposPorChave.has(secao.chave) ? { ...secao, corpo: corposPorChave.get(secao.chave)! } : secao,
  );
  // Só acrescenta: uma vez aceita a sugestão da IA numa seção, o rótulo "revisado por IA" fica
  // mesmo que o advogado ajuste o texto depois (ele já viu e escolheu manter a correção).
  const revisadasIA = new Set(atual.secoes_revisadas_ia);
  for (const chave of chaves.data) {
    if (form.get(`revisadoIA:${chave}`) === "1") revisadasIA.add(chave);
  }

  await db.query(
    `UPDATE case_petitions SET secoes = $2::jsonb, pendencias = $3::jsonb,
       secoes_revisadas_ia = $4::jsonb, atualizado_em = now() WHERE id = $1`,
    [
      petitionId.data,
      JSON.stringify(secoes),
      JSON.stringify(listarPendencias(secoes)),
      JSON.stringify([...revisadasIA]),
    ],
  );
  // case_petitions serve tanto a petição inicial quanto as peças pós-decisão (app/equipe/
  // [caseId]/pecas) — revalida as duas, a que não foi a origem do salvamento é um no-op barato.
  revalidatePath(`/equipe/${caseId.data}/peticao`);
  revalidatePath(`/equipe/${caseId.data}/pecas`);
}

/**
 * Corrige a redação de UMA seção (nunca a petição inteira de uma vez): o advogado avalia e
 * aceita ou descarta antes de qualquer coisa ser salva (ver gerarCorrecaoSecao). Vale para
 * qualquer tipo de peça gravada em case_petitions — petição inicial ou qualquer uma das peças
 * pós-decisão (ver app/equipe/[caseId]/pecas) —, por isso a cota mensal de IA (migração 0025) é
 * conferida aqui, num único lugar, em vez de em cada action que gera um tipo de peça.
 */
export async function corrigirSecaoIAAction(
  petitionId: string,
  chave: string,
): Promise<{ sugestao?: string; error?: string }> {
  const actor = await currentUserId();
  if (!actor) return { error: "Não autenticado." };
  if (!z.uuid().safeParse(petitionId).success || !chave) return { error: "Dados inválidos." };

  const db = getDb();
  const rows = await db.query<{ case_id: string; titulo_modelo: string; secoes: PetitionSection[] }>(
    "SELECT case_id, titulo_modelo, secoes FROM case_petitions WHERE id = $1",
    [petitionId],
  );
  const row = rows[0];
  if (!row) return { error: "Petição não encontrada." };
  const secao = row.secoes.find((s) => s.chave === chave);
  if (!secao) return { error: "Seção não encontrada." };

  const ctx = await getCaseService().getTriageContext(row.case_id);
  if (!ctx) return { error: "Caso não encontrado." };

  // Só consome a cota depois de confirmar que há mesmo uma chamada de IA a fazer — nunca por um
  // ID inválido ou seção inexistente.
  const [{ permitido }] = await db.query<{ permitido: boolean }>(
    "SELECT consumir_auxilio_ia() AS permitido",
  );
  if (!permitido) {
    return {
      error: "Limite de 100 auxílios de IA deste mês já foi atingido. Volta a liberar no mês seguinte.",
    };
  }

  try {
    const { corpoCorrigido } = await gerarCorrecaoSecao({
      areaNome: ctx.area.name,
      tituloModelo: row.titulo_modelo,
      tituloSecao: secao.titulo,
      corpoAtual: secao.corpo,
    });
    return { sugestao: corpoCorrigido };
  } catch {
    return { error: "Não foi possível corrigir agora. Tente novamente em instantes." };
  }
}

/** Exclui esta versão da petição — não afeta outras versões geradas para o mesmo caso. */
export async function excluirPeticaoAction(form: FormData) {
  const petitionId = z.uuid().safeParse(form.get("petitionId"));
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const actor = await currentUserId();
  if (!actor || !petitionId.success || !caseId.success) return;
  await getDb().query("DELETE FROM case_petitions WHERE id = $1 AND case_id = $2", [
    petitionId.data,
    caseId.data,
  ]);
  revalidatePath(`/equipe/${caseId.data}/peticao`);
  revalidatePath(`/equipe/${caseId.data}/pecas`);
}
