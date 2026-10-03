"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { cpfCnpjValido, somenteDigitos } from "@/lib/billing/validacao";
import { calcularDataFinal, deadlineCountingRuleSchema } from "@/domain/deadline/schema";
import { concluirPrazo, criarPrazo } from "@/lib/services/equipe-prazos";
import type { CaseStatus } from "@/domain/case/schema";
import { feeTypeSchema, contractStatusSchema } from "@/domain/contract/schema";
import { parseMoney } from "@/domain/triage/money";
import {
  adicionarParcela,
  atualizarStatusContrato,
  buscarContrato,
  criarContrato,
  excluirContrato,
  marcarParcelaPaga,
  registrarViabilidade,
} from "@/lib/services/equipe-contratos";
import { getCaseService } from "@/lib/services";
import { checkRateLimit } from "@/lib/rate-limit";
import { gerarResumoCaso } from "@/lib/ai/resumo-caso";
import { salvarResumoIA } from "@/lib/services/resumo-ia";

export async function assignLawyer(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const lawyerId = z.string().min(1).max(255).safeParse(form.get("lawyerId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !lawyerId.success) return;
  const db = getDb();
  // O banco verifica: administrador do escritório, advogado do mesmo escritório,
  // caso finalizado daquele escritório. A atribuição nunca confia no formulário.
  await db.transaction(async (tx) => {
    const inserted = await tx.query<{ case_id: string }>(
      `INSERT INTO case_assignments(case_id, lawyer_id, office_id)
       SELECT c.id, $2, c.office_id FROM legal_cases c WHERE c.id = $1
       ON CONFLICT DO NOTHING RETURNING case_id`,
      [caseId.data, lawyerId.data],
    );
    if (inserted.length) {
      await tx.query(
        "INSERT INTO audit_logs(actor_id, case_id, action) VALUES ($1, $2, 'assign_lawyer')",
        [actor, caseId.data],
      );
    }
  });
  revalidatePath("/equipe");
}

export async function verifyLawyerOab(form: FormData) {
  const lawyerId = z.string().min(1).max(255).safeParse(form.get("lawyerId"));
  const actor = await currentUserId();
  if (!actor || !lawyerId.success) return;
  // A política RLS confere, dentro da função verify_lawyer_oab: só admin, só do mesmo
  // escritório, só advogado com OAB informada — nunca confia no formulário.
  await getDb().query("SELECT verify_lawyer_oab($1)", [lawyerId.data]);
  revalidatePath("/equipe/pendentes");
  revalidatePath("/equipe");
}

/** A OAB sai autodeclarada no cadastro (migração 0020) — isto desfaz, para quem desconfiar de um
 * número até checar manualmente. A função revoke_lawyer_oab confere admin do mesmo escritório. */
export async function revogarOabAction(form: FormData) {
  const lawyerId = z.string().min(1).max(255).safeParse(form.get("userId"));
  const actor = await currentUserId();
  if (!actor || !lawyerId.success) return;
  await getDb().query("SELECT revoke_lawyer_oab($1)", [lawyerId.data]);
  revalidatePath("/equipe/time");
  revalidatePath("/equipe");
}

export async function criarPrazoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const dataInicio = z.iso.date().safeParse(form.get("dataInicio"));
  const quantidadeDias = z.coerce.number().int().min(1).max(3650).safeParse(form.get("dias"));
  const regra = deadlineCountingRuleSchema.safeParse(form.get("regra"));
  const tipo = z.string().trim().min(1).max(160).safeParse(form.get("tipo"));
  const actor = await currentUserId();
  if (
    !actor ||
    !caseId.success ||
    !dataInicio.success ||
    !quantidadeDias.success ||
    !regra.success ||
    !tipo.success
  ) {
    return;
  }
  const dueDate = calcularDataFinal(new Date(dataInicio.data), quantidadeDias.data, regra.data);
  // A política RLS (deadlines_insert) confere acesso ao caso e papel de advogado/admin.
  await criarPrazo(getDb(), {
    caseId: caseId.data,
    dueDate: dueDate.toISOString().slice(0, 10),
    type: tipo.data,
    countingRule: regra.data,
    assignedTo: actor,
    createdBy: actor,
  });
  revalidatePath(`/equipe/${caseId.data}`);
  revalidatePath("/equipe");
}

export async function concluirPrazoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const deadlineId = z.uuid().safeParse(form.get("deadlineId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !deadlineId.success) return;
  // A política RLS (deadlines_update) só deixa o responsável pelo prazo ou um admin concluir.
  await concluirPrazo(getDb(), deadlineId.data);
  revalidatePath(`/equipe/${caseId.data}`);
  revalidatePath("/equipe");
}

export async function registrarViabilidadeAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const feasibilityNote = z.string().trim().min(1).max(4000).safeParse(form.get("nota"));
  const risk = z.enum(["low", "medium", "high"]).safeParse(form.get("risco"));
  const decision = z.enum(["accepted", "rejected", "needs_info"]).safeParse(form.get("decisao"));
  const actor = await currentUserId();
  if (
    !actor ||
    !caseId.success ||
    !feasibilityNote.success ||
    !risk.success ||
    !decision.success
  ) {
    redirect(`/equipe/${form.get("caseId")}?erro=viabilidade_dados`);
  }
  const db = getDb();
  const atual = await db.query<{ status: CaseStatus }>(
    "SELECT status FROM legal_cases WHERE id = $1",
    [caseId.data],
  );
  if (!atual[0]) redirect(`/equipe/${caseId.data}?erro=viabilidade_dados`);
  try {
    await registrarViabilidade(db, {
      caseId: caseId.data,
      feasibilityNote: feasibilityNote.data,
      risk: risk.data,
      decision: decision.data,
      decidedBy: actor,
      statusAtual: atual[0].status,
    });
  } catch {
    redirect(`/equipe/${caseId.data}?erro=viabilidade_transicao`);
  }
  revalidatePath(`/equipe/${caseId.data}`);
  revalidatePath("/equipe");
}

export async function criarContratoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const feeType = feeTypeSchema.safeParse(form.get("tipoHonorario"));
  const feeValue = parseMoney(String(form.get("valor") ?? ""));
  const successPercentualBruto = String(form.get("percentualExito") ?? "").trim();
  const actor = await currentUserId();
  if (!actor || !caseId.success) redirect("/equipe");
  if (!feeType.success || !feeValue.ok) {
    redirect(`/equipe/${caseId.data}/contrato?erro=contrato_dados`);
  }
  let successPercentage: number | null = null;
  if (successPercentualBruto) {
    const pct = Number(successPercentualBruto.replace(",", "."));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      redirect(`/equipe/${caseId.data}/contrato?erro=contrato_percentual`);
    }
    successPercentage = pct;
  }
  await criarContrato(getDb(), {
    caseId: caseId.data,
    feeType: feeType.data,
    feeValueCents: feeValue.cents,
    successPercentage,
    createdBy: actor,
  });
  revalidatePath(`/equipe/${caseId.data}/contrato`);
}

export async function mudarStatusContratoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const contractId = z.uuid().safeParse(form.get("contractId"));
  const proximoStatus = contractStatusSchema.safeParse(form.get("proximoStatus"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !contractId.success || !proximoStatus.success) return;
  const db = getDb();
  const atual = await db.query<{ status: "draft" | "sent" | "signed" | "cancelled" }>(
    "SELECT status FROM contracts WHERE id = $1",
    [contractId.data],
  );
  if (!atual[0]) return;
  // A política RLS (contracts_update) já restringe a advogado/admin com acesso ao caso;
  // assertContractTransition (dentro do serviço) garante que a transição pedida é válida.
  try {
    await atualizarStatusContrato(db, contractId.data, atual[0].status, proximoStatus.data);
  } catch {
    redirect(`/equipe/${caseId.data}/contrato?erro=contrato_transicao`);
  }
  revalidatePath(`/equipe/${caseId.data}/contrato`);
}

export async function adicionarParcelaAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const contractId = z.uuid().safeParse(form.get("contractId"));
  const dueDate = z.iso.date().safeParse(form.get("dataVencimento"));
  const amount = parseMoney(String(form.get("valorParcela") ?? ""));
  const actor = await currentUserId();
  if (!actor || !caseId.success) redirect("/equipe");
  if (!contractId.success || !dueDate.success || !amount.ok) {
    redirect(`/equipe/${caseId.data}/contrato?erro=parcela_dados`);
  }
  await adicionarParcela(getDb(), {
    contractId: contractId.data,
    dueDate: dueDate.data,
    amountCents: amount.cents,
  });
  revalidatePath(`/equipe/${caseId.data}/contrato`);
}

export async function marcarParcelaPagaAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const installmentId = z.uuid().safeParse(form.get("installmentId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !installmentId.success) return;
  await marcarParcelaPaga(getDb(), installmentId.data);
  revalidatePath(`/equipe/${caseId.data}/contrato`);
}

// ---------------------------------------------------------------- Portal do Advogado, PR8

export async function promoverAdminAction(form: FormData) {
  const lawyerId = z.string().min(1).max(255).safeParse(form.get("userId"));
  const actor = await currentUserId();
  if (!actor || !lawyerId.success) return;
  // A função promote_to_admin (migração 0015) confere: ator é admin, alvo é advogado do mesmo
  // escritório — nunca confia no formulário.
  await getDb().query("SELECT promote_to_admin($1)", [lawyerId.data]);
  revalidatePath("/equipe/time");
}

export async function rebaixarAdvogadoAction(form: FormData) {
  const adminId = z.string().min(1).max(255).safeParse(form.get("userId"));
  const actor = await currentUserId();
  if (!actor || !adminId.success) redirect("/equipe/time?erro=equipe_ultimo_admin");
  try {
    await getDb().query("SELECT demote_to_lawyer($1)", [adminId.data]);
  } catch {
    redirect("/equipe/time?erro=equipe_ultimo_admin");
  }
  revalidatePath("/equipe/time");
}

export async function removerDaEquipeAction(form: FormData) {
  const userId = z.string().min(1).max(255).safeParse(form.get("userId"));
  const actor = await currentUserId();
  if (!actor || !userId.success) redirect("/equipe/time?erro=equipe_ultimo_admin");
  try {
    await getDb().query("SELECT remove_from_office($1)", [userId.data]);
  } catch {
    redirect("/equipe/time?erro=equipe_ultimo_admin");
  }
  revalidatePath("/equipe/time");
  revalidatePath("/equipe");
}

const conviteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  role: z.enum(["lawyer", "staff"]),
  cpf: z
    .string()
    .transform(somenteDigitos)
    .refine((v) => v.length === 11 && cpfCnpjValido(v), "CPF inválido"),
  oabNumero: z.string().trim().max(20).optional(),
  oabUf: z.string().trim().length(2).optional(),
});

/**
 * O advogado que administra o escritório monta a equipe convidando por e-mail: "advogado" exige
 * CPF e OAB (o número é só o que o admin digitou — oab_verificado_por grava quem convidou, nunca
 * a própria pessoa, já que não foi autodeclaração); "administrativo" só exige CPF. O limite de 5,
 * o papel de admin do ator e a regra de OAB por papel são conferidos de novo dentro de
 * convidar_membro_equipe — o formulário nunca é a autorização de fato.
 */
export async function convidarMembroAction(form: FormData) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const parsed = conviteSchema.safeParse({
    email: form.get("email"),
    role: form.get("role"),
    cpf: form.get("cpf"),
    oabNumero: form.get("oabNumero") || undefined,
    oabUf: form.get("oabUf") || undefined,
  });
  if (!parsed.success) redirect("/equipe/time?erro=convite_dados");
  const { email, role, cpf, oabNumero, oabUf } = parsed.data;
  if (role === "lawyer" && (!oabNumero || !oabUf)) {
    redirect("/equipe/time?erro=convite_oab_obrigatoria");
  }
  try {
    await getDb().query("SELECT convidar_membro_equipe($1, $2, $3, $4, $5, $6)", [
      randomUUID(),
      email,
      role,
      cpf,
      role === "lawyer" ? oabNumero : null,
      role === "lawyer" ? oabUf?.toUpperCase() : null,
    ]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    redirect(`/equipe/time?erro=${msg.includes("5 funcionários") ? "convite_limite" : "convite_falhou"}`);
  }
  revalidatePath("/equipe/time");
}

export async function cancelarConviteAction(form: FormData) {
  const inviteId = z.uuid().safeParse(form.get("inviteId"));
  const actor = await currentUserId();
  if (!actor || !inviteId.success) return;
  await getDb().query("SELECT cancelar_convite_equipe($1)", [inviteId.data]);
  revalidatePath("/equipe/time");
}

export async function addCaseNote(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const body = z.string().trim().min(1).max(4000).safeParse(form.get("body"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !body.success) return;
  // A política RLS exige acesso profissional ao caso e registra o autor da sessão.
  await getDb().query(
    "INSERT INTO case_notes(id, case_id, author_id, body) VALUES ($1, $2, $3, $4)",
    [crypto.randomUUID(), caseId.data, actor, body.data],
  );
  revalidatePath(`/equipe/${caseId.data}`);
}

// ---------------------------------------------------------------- F3: resumo de caso por IA

/**
 * Sempre uma ação explícita do advogado — nunca automática — para controlar custo e deixar
 * claro que é opt-in. O dossiê (não a triagem bruta) é a única fonte enviada à IA: já é
 * determinístico e fiel ao que o cidadão informou, então o resumo não tem o que inventar.
 */
export async function gerarResumoIAAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success) redirect("/equipe");

  if (!(await checkRateLimit(`resumo-ia:${caseId.data}`, 10, 3600))) {
    redirect(`/equipe/${caseId.data}?erro=ia_limite`);
  }

  // A política RLS do próprio getSubmission já restringe a advogado/admin com acesso ao caso.
  const submission = await getCaseService().getSubmission(caseId.data);
  if (!submission) redirect("/equipe");

  try {
    const { resumo, modelo } = await gerarResumoCaso(submission.dossier);
    await salvarResumoIA(getDb(), { caseId: caseId.data, resumo, modelo, geradoPor: actor });
  } catch (error) {
    // Nunca expor detalhes internos ao navegador (podem incluir credencial/URL do provedor).
    console.error("[equipe] falha ao gerar resumo com IA", error);
    redirect(`/equipe/${caseId.data}?erro=ia_falhou`);
  }
  revalidatePath(`/equipe/${caseId.data}`);
}

// ---------------------------------------------------------------- Exclusão de registros

/** Só antes de aceito/em andamento (isDeletable); a RLS (migração 0017) aplica a mesma regra. */
export async function excluirCasoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success) redirect("/equipe");
  const result = await getCaseService().deleteCase(caseId.data);
  redirect(result.ok ? "/equipe" : `/equipe/${caseId.data}?erro=nao_excluivel`);
}

/** Só contrato em rascunho ou cancelado — nunca enviado nem assinado. */
export async function excluirContratoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const contractId = z.uuid().safeParse(form.get("contractId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success || !contractId.success) return;
  const db = getDb();
  const atual = await buscarContrato(db, contractId.data);
  if (!atual) return;
  const excluido = await excluirContrato(db, contractId.data, atual.status);
  if (!excluido) redirect(`/equipe/${caseId.data}/contrato?erro=contrato_nao_excluivel`);
  revalidatePath(`/equipe/${caseId.data}/contrato`);
}

/** Em qualquer status — só oculta da fila padrão, nunca apaga nada, e é reversível. */
export async function arquivarCasoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success) redirect("/equipe");
  await getCaseService().archiveCase(caseId.data);
  revalidatePath(`/equipe/${caseId.data}`);
}

export async function desarquivarCasoAction(form: FormData) {
  const caseId = z.uuid().safeParse(form.get("caseId"));
  const actor = await currentUserId();
  if (!actor || !caseId.success) redirect("/equipe");
  await getCaseService().unarchiveCase(caseId.data);
  revalidatePath(`/equipe/${caseId.data}`);
}
