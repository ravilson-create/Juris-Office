import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import type { LegalCase } from "@/domain/case/schema";
import { currentUserId } from "./session";

/**
 * Sessão anônima do navegador (cookie httpOnly com um id aleatório — só o hash dele é
 * armazenado no banco). Existe independentemente do login: a decisão de produto é que entrar
 * numa conta é sempre opcional para o cidadão, nunca obrigatório para usar o atendimento.
 */
export const SESSION_COOKIE = "jo_sessao";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

export function hashSession(sessionId: string): string {
  return createHash("sha256").update(`juris-office:${sessionId}`).digest("hex");
}

async function readSessionId(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && z.uuid().safeParse(value).success ? value : null;
}

/** Hash da sessão anônima atual, sem criar cookie. Null se o navegador ainda não tiver uma. */
export async function currentAnonHash(): Promise<string | null> {
  const id = await readSessionId();
  return id ? hashSession(id) : null;
}

/** Só em Server Actions/Route Handlers (onde cookies podem ser gravados). Cria o cookie na
 * primeira vez e devolve sempre o mesmo hash depois disso. */
async function ensureAnonHash(): Promise<string> {
  let id = await readSessionId();
  if (!id) {
    id = randomUUID();
    (await cookies()).set(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  return hashSession(id);
}

/**
 * Hash/identificador de quem está pedindo — a conta logada quando houver, senão a sessão
 * anônima do navegador. Usado para listar "meus atendimentos" e como chave de rate limit; nunca
 * cria cookie (use ensureSessionHash para isso).
 */
export async function currentSessionHash(): Promise<string | null> {
  return (await currentUserId()) ?? (await currentAnonHash());
}

/**
 * Igual a currentSessionHash(), mas garante que exista uma sessão para quem ainda não tem conta
 * nem cookie — só pode ser chamado em Server Actions ou Route Handlers (onde cookies podem ser
 * gravados). O login nunca é exigido aqui: é sempre uma opção além do fluxo anônimo, nunca um
 * requisito para iniciar ou continuar um atendimento.
 */
export async function ensureSessionHash(): Promise<string> {
  const userId = await currentUserId();
  if (userId) return userId;
  return ensureAnonHash();
}

/** Verdadeiro se quem pede é o dono do atendimento — pela conta (citizenId) ou pelo navegador
 * que o criou (ownerSessionHash), o que valer para este caso. Comparação do hash em tempo
 * constante, já que ambos podem conter dados de terceiros tentando adivinhar o dono certo. */
export async function canAccessCase(
  legalCase: Pick<LegalCase, "ownerSessionHash" | "citizenId">,
): Promise<boolean> {
  const userId = await currentUserId();
  if (userId && legalCase.citizenId === userId) return true;
  const anon = await currentAnonHash();
  if (!anon || !legalCase.ownerSessionHash) return false;
  const a = Buffer.from(anon, "hex");
  const b = Buffer.from(legalCase.ownerSessionHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Vincula casos anônimos deste navegador à conta recém-logada, uma única vez. */
export async function claimLegacyCases(): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const anon = await currentAnonHash();
  if (!anon) return;
  const { getDb } = await import("@/lib/db/connection");
  await getDb().query("SELECT claim_legacy_cases($1)", [anon]);
  (await cookies()).delete(SESSION_COOKIE);
}
