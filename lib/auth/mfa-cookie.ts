import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * "MFA verificado neste navegador" não fica no banco (não é estado de conta, é estado de
 * dispositivo/sessão) — um cookie httpOnly assinado com o mesmo segredo da Neon Auth. Dura 12h:
 * tempo suficiente para não pedir o código a cada clique, curto o bastante para não virar um
 * "lembrar para sempre" de fato.
 */
const MFA_COOKIE = "jo_mfa_ok";
const MFA_MAX_AGE_SECONDS = 60 * 60 * 12;

function segredo(): string {
  const s = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!s) throw new Error("NEON_AUTH_COOKIE_SECRET não configurada.");
  return s;
}

function assinar(userId: string): string {
  return createHmac("sha256", segredo()).update(userId).digest("hex");
}

export async function marcarMfaVerificado(userId: string): Promise<void> {
  (await cookies()).set(MFA_COOKIE, assinar(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MFA_MAX_AGE_SECONDS,
  });
}

export async function mfaVerificadoNesteNavegador(userId: string): Promise<boolean> {
  const valor = (await cookies()).get(MFA_COOKIE)?.value;
  if (!valor) return false;
  const esperado = assinar(userId);
  // Comprimentos diferentes (hex de SHA-256 sempre tem 64 chars) não chegam ao timingSafeEqual,
  // que lança se os buffers não tiverem o mesmo tamanho — aqui isso só significa "não bate".
  if (valor.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(valor), Buffer.from(esperado));
}

/**
 * Os códigos de backup só existem em texto puro no instante em que são gerados — o banco guarda
 * só o hash (ver lib/services/mfa.ts). Para mostrá-los uma vez na página seguinte ao redirect da
 * confirmação, viajam num cookie httpOnly de 60s, lido e apagado na mesma leitura.
 */
const BACKUP_COOKIE = "jo_mfa_backup_tmp";

export async function guardarCodigosBackupTemporarios(codigos: string[]): Promise<void> {
  (await cookies()).set(BACKUP_COOKIE, JSON.stringify(codigos), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/mfa",
    maxAge: 60,
  });
}

export async function lerERemoverCodigosBackupTemporarios(): Promise<string[] | null> {
  const jar = await cookies();
  const valor = jar.get(BACKUP_COOKIE)?.value;
  if (!valor) return null;
  jar.delete(BACKUP_COOKIE);
  try {
    const codigos = JSON.parse(valor);
    return Array.isArray(codigos) ? codigos : null;
  } catch {
    return null;
  }
}
