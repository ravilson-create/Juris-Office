import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import type { LegalCase } from "@/domain/case/schema";

/**
 * Vínculo provisório entre o atendimento e o navegador que o criou (fase F1, sem login).
 * O navegador guarda um identificador de sessão aleatório em cookie httpOnly; o caso guarda
 * apenas o hash SHA-256 desse identificador. Na fase F5 isto é substituído por Supabase Auth + RLS.
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

/** Hash da sessão atual, sem criar cookie (páginas podem só ler). Null se não houver sessão. */
export async function currentSessionHash(): Promise<string | null> {
  const id = await readSessionId();
  return id ? hashSession(id) : null;
}

/** Só pode ser chamado em Server Actions ou Route Handlers (onde cookies podem ser gravados). */
export async function ensureSessionHash(): Promise<string> {
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

/** Verdadeiro se o navegador atual é o dono do atendimento. Comparação em tempo constante. */
export async function canAccessCase(
  legalCase: Pick<LegalCase, "ownerSessionHash">,
): Promise<boolean> {
  const id = await readSessionId();
  if (!id || !legalCase.ownerSessionHash) return false;
  const a = Buffer.from(hashSession(id), "hex");
  const b = Buffer.from(legalCase.ownerSessionHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
