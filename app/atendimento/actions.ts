"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { RawFormValues } from "@/domain/triage/schema";
import { canAccessCase, ensureSessionHash } from "@/lib/auth/case-access";
import { getCaseService } from "@/lib/services";
import { DomainError, type ServiceResult } from "@/lib/services/errors";

const idSchema = z.uuid();
const INVALID = { ok: false, message: "Atendimento não encontrado ou sem permissão." } as const;

function toFailure(error: unknown): { ok: false; message: string } {
  if (error instanceof DomainError) return { ok: false, message: error.message };
  // Nunca expor detalhes internos ao navegador nem registrar dados pessoais.
  console.error("[atendimento] erro inesperado", error instanceof Error ? error.name : "unknown");
  return { ok: false, message: "Não foi possível salvar agora. Tente novamente em instantes." };
}

/** Único ponto de autorização das ações: ID válido + atendimento pertence a este navegador. */
async function authorized(caseId: unknown): Promise<boolean> {
  if (!idSchema.safeParse(caseId).success) return false;
  const overview = await getCaseService().getOverview(caseId as string);
  return overview !== null && (await canAccessCase(overview.legalCase));
}

/** Executa uma ação autorizada, convertendo erros em mensagens seguras. */
async function run<T>(
  caseId: unknown,
  fn: () => Promise<ServiceResult<T>>,
): Promise<ServiceResult<T>> {
  if (!(await authorized(caseId))) return INVALID;
  try {
    return await fn();
  } catch (error) {
    return toFailure(error);
  }
}

const toNull = <T>(r: ServiceResult<T>): ServiceResult<null> =>
  r.ok ? { ok: true, data: null } : r;

// ------------------------------------------------------------------ Sprint 1

export async function createCaseAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("area") ?? "").slice(0, 40);
  const owner = await ensureSessionHash();
  let target: string;
  try {
    const legalCase = await getCaseService().createCase(slug, owner);
    target = `/atendimento/${legalCase.id}/identificacao`;
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    target = "/atendimento?erro=area";
  }
  redirect(target);
}

/**
 * Depois de gravar, a navegação é feita pelo servidor (`redirect`), não pelo navegador.
 * O roteador do Next processa o redirecionamento como parte da própria ação; chamar
 * `router.push` logo após o fim da ação podia ser descartado (ver CHANGELOG, item 4.1-I).
 * `fromReview` volta à revisão em vez de seguir o fluxo normal. Só devolve algo em caso de falha.
 */
export async function saveApplicantAction(
  caseId: string,
  values: unknown,
  fromReview = false,
): Promise<ServiceResult<null>> {
  const result = await run(caseId, async () =>
    toNull(await getCaseService().saveApplicant(caseId, values)),
  );
  if (result.ok)
    redirect(fromReview ? `/atendimento/${caseId}/revisar` : `/atendimento/${caseId}/triagem`);
  return result;
}

/** Limites de tamanho para o que chega do navegador (defesa contra payloads abusivos). */
const rawValuesSchema = z
  .record(
    z.string().max(64),
    z.union([z.string().max(10_000), z.array(z.string().max(200)).max(50)]),
  )
  .refine((v) => Object.keys(v).length <= 100);

export async function saveTriageStepAction(
  caseId: string,
  stepIndex: number,
  values: RawFormValues,
  fromReview = false,
): Promise<ServiceResult<null>> {
  const parsed = rawValuesSchema.safeParse(
    Object.fromEntries(Object.entries(values ?? {}).filter(([, v]) => v !== undefined)),
  );
  if (!parsed.success || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 50) {
    return { ok: false, message: "Respostas em formato inválido." };
  }
  const result = await run(caseId, () =>
    getCaseService().saveTriageStep(caseId, stepIndex, parsed.data),
  );
  if (!result.ok) return result;
  const base = `/atendimento/${caseId}`;
  if (fromReview) redirect(`${base}/revisar`);
  const { nextStep } = result.data;
  redirect(nextStep === null ? `${base}/relato` : `${base}/triagem?etapa=${nextStep + 1}`);
}

// ------------------------------------------------------------------ Sprint 2

export async function saveNarrativeAction(
  caseId: string,
  values: unknown,
  fromReview = false,
): Promise<ServiceResult<null>> {
  const result = await run(caseId, async () =>
    toNull(await getCaseService().saveNarrative(caseId, values)),
  );
  if (result.ok)
    redirect(fromReview ? `/atendimento/${caseId}/revisar` : `/atendimento/${caseId}/documentos`);
  return result;
}

/** Upload simulado: recebe só metadados do arquivo (nome, tipo, tamanho). */
export async function addDocumentAction(
  caseId: string,
  meta: unknown,
): Promise<ServiceResult<null>> {
  return run(caseId, async () => toNull(await getCaseService().addDocument(caseId, meta)));
}

export async function removeDocumentAction(
  caseId: string,
  documentId: string,
): Promise<ServiceResult<null>> {
  if (!idSchema.safeParse(documentId).success) return { ok: false, message: "Documento inválido." };
  return run(caseId, () => getCaseService().removeDocument(caseId, documentId));
}

/** Para onde levar a pessoa quando uma regra impede a ação. */
function recoveryPath(caseId: string, error: DomainError): string {
  const base = `/atendimento/${caseId}`;
  switch (error.code) {
    case "not_editable":
      return `${base}/protocolo`;
    case "identification_pending":
      return `${base}/identificacao`;
    case "triage_pending":
      return `${base}/triagem`;
    case "narrative_pending":
      return `${base}/relato`;
    default:
      return `${base}/revisar`;
  }
}

export async function finishDocumentsAction(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!(await authorized(caseId))) redirect("/atendimento");
  let target = `/atendimento/${caseId}/revisar`;
  try {
    await getCaseService().finishDocuments(caseId);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    target = recoveryPath(caseId, error);
  }
  redirect(target);
}

// ------------------------------------------------------------------ Sprint 3

export async function submitCaseAction(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!(await authorized(caseId))) redirect("/atendimento");
  let target = `/atendimento/${caseId}/protocolo`;
  try {
    await getCaseService().submitCase(caseId);
  } catch (error) {
    // A página de destino sabe levar a pessoa à etapa pendente.
    if (!(error instanceof DomainError)) throw error;
    target = recoveryPath(caseId, error);
  }
  redirect(target);
}

// ---------------------------------------------------------------- Sprint 4.1

export type DraftSaveResponse =
  | { ok: true; status: "saved" | "stale"; savedAt: string }
  | { ok: false; reason: "locked" | "invalid" | "error"; message: string };

/** Rascunho de formulário: não valida preenchimento e nunca conclui etapa. */
export async function saveDraftAction(
  caseId: string,
  scope: string,
  values: unknown,
  meta: unknown,
): Promise<DraftSaveResponse> {
  if (!(await authorized(caseId))) {
    return { ok: false, reason: "invalid", message: INVALID.message };
  }
  try {
    const r = await getCaseService().saveDraft(caseId, scope, values, meta);
    return r.ok ? { ok: true, ...r.data } : { ok: false, reason: "invalid", message: r.message };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_editable") {
      return { ok: false, reason: "locked", message: error.message };
    }
    return { ok: false, reason: "error", message: toFailure(error).message };
  }
}
