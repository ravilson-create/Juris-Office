import "server-only";
import { isValidProtocol } from "@/domain/case/protocol";
import { digest } from "@/lib/auth/password";
import { currentActorId } from "@/lib/auth/session";
import { privateQuery } from "@/lib/db/private";
export async function issueTrackingToken(caseId: string) {
  const actor = await currentActorId();
  if (!actor) throw new Error("Sem permissão");
  const [c] = await privateQuery<{ protocol: string }>(
    "SELECT protocol FROM legal_cases WHERE id=$1 AND citizen_id=$2 AND submitted_at IS NOT NULL",
    [caseId, actor],
  );
  if (!c || !isValidProtocol(c.protocol))
    throw new Error("Protocolo legado não habilitado para consulta pública");
  await privateQuery(
    `INSERT INTO case_tracking_tokens(case_id,token_hash) VALUES($1,$2)
 ON CONFLICT(case_id) DO NOTHING`,
    [caseId, digest(c.protocol)],
  );
  return c.protocol;
}
export type TrackingResult = {
  protocol: string;
  status: string;
  updatedAt: string;
  updates: { status: string; message: string; at: string }[];
};
export async function lookupTrackingToken(token: string): Promise<TrackingResult | null> {
  if (!isValidProtocol(token)) return null;
  const [row] = await privateQuery<{
    id: string;
    protocol: string;
    status: string;
    updated_at: Date;
  }>(
    `SELECT c.id,c.protocol,c.status,c.updated_at FROM case_tracking_tokens t JOIN legal_cases c ON c.id=t.case_id
 WHERE t.token_hash=$1 AND c.submitted_at IS NOT NULL`,
    [digest(token)],
  );
  if (!row) return null;
  const updates = await privateQuery<{ status: string; message: string; created_at: Date }>(
    "SELECT status,message,created_at FROM case_public_updates WHERE case_id=$1 ORDER BY created_at DESC LIMIT 50",
    [row.id],
  );
  return {
    protocol: row.protocol,
    status: row.status,
    updatedAt: new Date(row.updated_at).toISOString(),
    updates: updates.map((u) => ({
      status: u.status,
      message: u.message,
      at: new Date(u.created_at).toISOString(),
    })),
  };
}
