import { cookies } from "next/headers";
import { digest } from "./password";
export const authEnabled = Boolean(process.env.DATABASE_URL);
export function assertAuthConfiguration(): void {}
export const PROFESSIONAL_COOKIE = "jo_professional";
export async function currentIdentity(): Promise<{
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
} | null> {
  if (!authEnabled) return null;
  const token = (await cookies()).get(PROFESSIONAL_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { privateQuery } = await import("@/lib/db/private");
  const rows = await privateQuery<{ id: string; email: string; name: string }>(
    `SELECT u.id,u.email,u.name FROM professional_sessions s JOIN professional_accounts u ON u.id=s.user_id
   WHERE s.token_hash=$1 AND s.expires_at>now() AND u.enabled=true`,
    [digest(token)],
  );
  return rows[0] ? { ...rows[0], emailVerified: false } : null;
}
export async function currentUserId() {
  return (await currentIdentity())?.id ?? null;
}
// Identidade anônima exclusiva do navegador, para manter as políticas RLS dos atendimentos.
export async function currentActorId() {
  const professional = await currentUserId();
  if (professional) return professional;
  const guest = (await cookies()).get("jo_sessao")?.value;
  return guest && /^[0-9a-f-]{36}$/.test(guest) ? `guest:${digest(guest)}` : null;
}
