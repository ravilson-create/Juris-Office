"use server";

import { redirect } from "next/navigation";
import { generateBackupCodes, generateTotpSecret, hashBackupCode, verifyTotp } from "@/domain/mfa/totp";
import { guardarCodigosBackupTemporarios, marcarMfaVerificado } from "@/lib/auth/mfa-cookie";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { checkRateLimit } from "@/lib/rate-limit";
import { buscarMfa, confirmarMfa, consumirCodigoBackup, desativarMfa, iniciarCadastroMfa } from "@/lib/services/mfa";

async function actorOuRedireciona(): Promise<string> {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  return actor;
}

/** Gera um novo segredo e deixa o cadastro pendente de confirmação. */
export async function iniciarCadastroMfaAction(): Promise<void> {
  await actorOuRedireciona();
  await iniciarCadastroMfa(getDb(), generateTotpSecret());
  redirect("/mfa/configurar");
}

export async function confirmarMfaAction(formData: FormData): Promise<void> {
  const actor = await actorOuRedireciona();
  const codigo = String(formData.get("codigo") ?? "");
  if (!(await checkRateLimit(`mfa-confirmar:${actor}`, 10, 900))) {
    redirect("/mfa/configurar?erro=limite");
  }

  const db = getDb();
  const mfa = await buscarMfa(db, actor);
  if (!mfa || mfa.enabled_at) redirect("/mfa/configurar");
  if (!verifyTotp(mfa.secret, codigo)) redirect("/mfa/configurar?erro=codigo_invalido");

  const codigosBackup = generateBackupCodes();
  await confirmarMfa(db, codigosBackup.map(hashBackupCode));
  await marcarMfaVerificado(actor);
  await guardarCodigosBackupTemporarios(codigosBackup);
  redirect("/mfa/configurar?confirmado=1");
}

export async function desativarMfaAction(): Promise<void> {
  await actorOuRedireciona();
  await desativarMfa(getDb());
  redirect("/mfa/configurar");
}

/** Segundo fator no acesso à área profissional — código do autenticador ou um backup. */
export async function verificarMfaAction(formData: FormData): Promise<void> {
  const actor = await actorOuRedireciona();
  const codigo = String(formData.get("codigo") ?? "").trim();
  if (!(await checkRateLimit(`mfa-verificar:${actor}`, 10, 900))) {
    redirect("/mfa/verificar?erro=limite");
  }

  const db = getDb();
  const mfa = await buscarMfa(db, actor);
  if (!mfa?.enabled_at) {
    // Nada ativado para verificar: segue em frente em vez de travar quem nunca configurou.
    await marcarMfaVerificado(actor);
    redirect("/equipe");
  }

  const viaTotp = verifyTotp(mfa.secret, codigo);
  const viaBackup = !viaTotp && /^[0-9a-f]{10}$/i.test(codigo) && (await consumirCodigoBackup(db, hashBackupCode(codigo)));
  if (!viaTotp && !viaBackup) redirect("/mfa/verificar?erro=codigo_invalido");

  await marcarMfaVerificado(actor);
  redirect("/equipe");
}
