import "server-only";
import { getMaintenanceDb } from "@/lib/db/connection";
import type { currentIdentity } from "./session";

/** Primeira administração: somente a conta com e-mail verificado configurado no servidor. */
export async function bootstrapAdmin(
  identity: NonNullable<Awaited<ReturnType<typeof currentIdentity>>>,
) {
  const expected = process.env.JURIS_ADMIN_EMAIL?.trim().toLowerCase();
  if (!expected || !identity.emailVerified || identity.email.toLowerCase() !== expected) return;
  const db = getMaintenanceDb();
  try {
    await db.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(727302)");
      await tx.query(
        `INSERT INTO profiles(user_id, role, email) VALUES ($1, 'citizen', $2)
         ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email`,
        [identity.id, identity.email],
      );
      await tx.query(
        `UPDATE profiles SET role = 'admin', office_id = '00000000-0000-4000-8000-000000000001'
         WHERE user_id = $1 AND role = 'citizen'
           AND NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin')`,
        [identity.id],
      );
    });
  } finally {
    await db.close();
  }
}
