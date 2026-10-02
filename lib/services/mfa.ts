import "server-only";
import type { Db } from "@/lib/db/types";

export type MfaRow = {
  user_id: string;
  secret: string;
  enabled_at: string | null;
  backup_codes: string[];
};

export async function buscarMfa(db: Db, userId: string): Promise<MfaRow | null> {
  const rows = await db.query<MfaRow>("SELECT * FROM profile_mfa WHERE user_id = $1", [userId]);
  return rows[0] ?? null;
}

/** Inicia (ou recomeça) o cadastro: grava o segredo, mas deixa 'enabled_at' nulo até confirmar. */
export async function iniciarCadastroMfa(db: Db, secret: string): Promise<void> {
  await db.query("SELECT enroll_own_mfa($1)", [secret]);
}

/** Liga o MFA de fato — só depois que o código foi conferido contra o segredo no servidor. */
export async function confirmarMfa(db: Db, backupCodeHashes: string[]): Promise<void> {
  await db.query("SELECT confirm_own_mfa($1)", [backupCodeHashes]);
}

export async function desativarMfa(db: Db): Promise<void> {
  await db.query("SELECT disable_own_mfa()");
}

/** true se o hash bateu com um código de backup ainda não usado (e o consome). */
export async function consumirCodigoBackup(db: Db, codeHash: string): Promise<boolean> {
  const rows = await db.query<{ consume_own_mfa_backup_code: boolean }>(
    "SELECT consume_own_mfa_backup_code($1)",
    [codeHash],
  );
  return rows[0]?.consume_own_mfa_backup_code ?? false;
}
