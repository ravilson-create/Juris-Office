"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { headers } from "next/headers";
import type { RawFormValues } from "@/domain/triage/schema";
import { canAccessCase, currentAnonHash, currentSessionHash, ensureSessionHash } from "@/lib/auth/case-access";
import { currentUserId } from "@/lib/auth/session";
import { clientIp } from "@/lib/http/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCaseService } from "@/lib/services";
import { assinarContrato, buscarContrato } from "@/lib/services/equipe-contratos";
import { escolherAdvogado } from "@/lib/services/advogados-disponiveis";
import {
  consultarAtendimentoPorProtocolo,
  type ResultadoConsultaProtocolo,
} from "@/lib/services/consulta-protocolo";
import { cpfCnpjValido, somenteDigitos } from "@/lib/billing/validacao";
import { isValidProtocol } from "@/domain/case/protocol";
import { getDb, getMaintenanceDb, hasDatabase } from "@/lib/db/connection";
import { DomainError, type ServiceResult } from "@/lib/services/errors";

const LIMITE_EXCEDIDO = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";

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
  const ip = await clientIp();
  // 30 novos atendimentos por IP a cada hora: generoso para uso real, baixo para automação.
  if (!(await checkRateLimit(`criar-atendimento:${ip}`, 30, 3600))) {
    redirect("/atendimento?erro=limite");
  }
  // O login (quando houver) decide o dono do atendimento, não uma configuração global: entrar
  // na conta é sempre opcional, então quem não está logado continua dono pela sessão anônima.
  const owner = await ensureSessionHash();
  const loggedIn = Boolean(await currentUserId());
  let target: string;
  try {
    const legalCase = await getCaseService().createCase(
      slug,
      loggedIn ? undefined : owner,
      loggedIn ? owner : undefined,
    );
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
  const sessionHash = await currentSessionHash();
  if (sessionHash && !(await checkRateLimit(`documento:${sessionHash}`, 60, 3600))) {
    return { ok: false, message: LIMITE_EXCEDIDO };
  }
  return run(caseId, async () => toNull(await getCaseService().addDocument(caseId, meta)));
}

export async function removeDocumentAction(
  caseId: string,
  documentId: string,
): Promise<ServiceResult<null>> {
  if (!idSchema.safeParse(documentId).success) return { ok: false, message: "Documento inválido." };
  return run(caseId, () => getCaseService().removeDocument(caseId, documentId));
}

/** Só antes de aceito/em andamento (ver isDeletable); a lista já só mostra o botão nesse caso,
 * então uma falha aqui só acontece se o status mudou entre a tela carregar e o clique. */
export async function excluirAtendimentoAction(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!(await authorized(caseId))) redirect("/atendimento/meus");
  const result = await getCaseService().deleteCase(caseId);
  redirect(result.ok ? "/atendimento/meus" : "/atendimento/meus?erro=nao_excluivel");
}

/** Em qualquer status — só oculta da lista, nunca apaga nada, e é reversível. */
export async function arquivarAtendimentoAction(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!(await authorized(caseId))) redirect("/atendimento/meus");
  await getCaseService().archiveCase(caseId);
  redirect("/atendimento/meus");
}

export async function desarquivarAtendimentoAction(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  if (!(await authorized(caseId))) redirect("/atendimento/meus");
  await getCaseService().unarchiveCase(caseId);
  redirect("/atendimento/meus");
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

/**
 * Escolha opcional de advogado, oferecida na revisão (ver app/atendimento/[caseId]/advogado) —
 * sempre finaliza o atendimento junto, no mesmo clique: quem chegou até aqui já revisou tudo.
 * escolherAdvogado() confere tudo de novo contra o banco (área, OAB, assinatura) antes de gravar.
 */
export async function escolherAdvogadoEFinalizarAction(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  const lawyerId = z.string().min(1).max(255).safeParse(formData.get("lawyerId"));
  if (!(await authorized(caseId)) || !lawyerId.success) redirect("/atendimento");
  let target = `/atendimento/${caseId}/protocolo`;
  try {
    await escolherAdvogado(getDb(), caseId, lawyerId.data);
    await getCaseService().submitCase(caseId);
  } catch (error) {
    if (error instanceof DomainError) {
      target = recoveryPath(caseId, error);
    } else {
      console.error("[atendimento] erro ao escolher advogado", error);
      target = `/atendimento/${caseId}/advogado?erro=advogado_indisponivel`;
    }
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
  const sessionHash = await currentSessionHash();
  // Rascunho é salvo a cada pausa de digitação: limite alto para não incomodar quem digita normal.
  if (sessionHash && !(await checkRateLimit(`rascunho:${sessionHash}`, 300, 3600))) {
    return { ok: false, reason: "error", message: LIMITE_EXCEDIDO };
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

// ---------------------------------------------------------------- Portal do Advogado, PR5

/**
 * Aceite eletrônico do contrato. Quem assina é sempre quem tem acesso ao caso (conta logada ou
 * sessão anônima do navegador) — a mesma regra de `canAccessCase` usada no resto da jornada do
 * cidadão, nunca uma identidade separada. A RLS (migração 0012) é a autorização de fato; aqui só
 * traduzimos erro em `?erro=` para a página mostrar.
 */
export async function assinarContratoAction(formData: FormData): Promise<void> {
  const caseId = String(formData.get("caseId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  const destino = `/atendimento/${caseId}/contrato`;
  if (!(await authorized(caseId))) redirect("/atendimento");
  if (!idSchema.safeParse(contractId).success) redirect(`${destino}?erro=contrato_invalido`);

  // Segundo dado de confirmação além do clique: o CPF é redigitado aqui, nunca pré-preenchido
  // pela tela, e conferido abaixo contra o CPF do interessado neste caso.
  const concordou = formData.get("concordouTermos") === "on";
  const cpfDigitado = somenteDigitos(String(formData.get("cpfConfirmacao") ?? ""));
  if (!concordou || cpfDigitado.length !== 11) {
    redirect(`${destino}?erro=contrato_confirmacao`);
  }

  const ip = await clientIp();
  if (!(await checkRateLimit(`assinar-contrato:${ip}`, 10, 3600))) {
    redirect(`${destino}?erro=limite`);
  }

  const db = getDb();
  const contrato = await buscarContrato(db, contractId);
  if (!contrato || contrato.case_id !== caseId) redirect(`${destino}?erro=contrato_invalido`);

  const overview = await getCaseService().getOverview(caseId);
  if (overview?.legalCase.applicant?.cpf !== cpfDigitado) {
    redirect(`${destino}?erro=contrato_cpf`);
  }

  const userId = await currentUserId();
  const anonHash = userId ? null : await currentAnonHash();
  const userAgent = (await headers()).get("user-agent") ?? "desconhecido";

  try {
    await assinarContrato(db, {
      contractId,
      statusAtual: contrato.status,
      signedBy: userId,
      signedByHash: anonHash,
      signerCpf: cpfDigitado,
      ip,
      userAgent,
    });
  } catch {
    redirect(`${destino}?erro=contrato_transicao`);
  }
  redirect(destino);
}

// ---------------------------------------------------------------- Consulta por protocolo

export type ConsultaProtocoloState =
  | { ok: true; resultado: ResultadoConsultaProtocolo }
  | { ok: false; message: string }
  | null;

/**
 * Único jeito de ver o andamento de um atendimento sem ser no navegador/sessão onde ele foi
 * aberto — por isso exige protocolo E CPF, nunca só o protocolo (ver canAccessCase/owns_case:
 * conhecer o protocolo nunca bastou aqui, e continua não bastando). Decisão consciente do dono
 * do produto: a consulta é só leitura, não vincula o atendimento a esta sessão nem permite
 * continuar um atendimento ainda em preenchimento a partir daqui.
 */
export async function consultarAtendimentoAction(
  _state: ConsultaProtocoloState,
  form: FormData,
): Promise<ConsultaProtocoloState> {
  if (!hasDatabase()) {
    return { ok: false, message: "Consulta por protocolo indisponível nesta instalação." };
  }
  const ip = await clientIp();
  if (!(await checkRateLimit(`consulta-protocolo:${ip}`, 10, 3600))) {
    return { ok: false, message: LIMITE_EXCEDIDO };
  }

  const protocolo = String(form.get("protocolo") ?? "").trim().toUpperCase();
  const cpfDigitos = somenteDigitos(String(form.get("cpf") ?? ""));
  if (!isValidProtocol(protocolo) || cpfDigitos.length !== 11 || !cpfCnpjValido(cpfDigitos)) {
    return { ok: false, message: "Confira o protocolo e o CPF informados." };
  }

  const db = getMaintenanceDb();
  try {
    const resultado = await consultarAtendimentoPorProtocolo(db, protocolo, cpfDigitos);
    if (!resultado) {
      return { ok: false, message: "Atendimento não encontrado. Confira o protocolo e o CPF." };
    }
    return { ok: true, resultado };
  } finally {
    await db.close();
  }
}
