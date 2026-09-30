import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { privateQuery, privateTransaction } from "@/lib/db/private";
import { digest, hashPassword, verifyPassword } from "./password";
import { PROFESSIONAL_COOKIE } from "./session";
const OFFICE = "00000000-0000-4000-8000-000000000001";
type Account = { id: string; email: string; name: string; password_hash: string; enabled: boolean };
export async function startSession(id: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await privateQuery(
    "INSERT INTO professional_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [digest(token), id, expires],
  );
  (await cookies()).set(PROFESSIONAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(PROFESSIONAL_COOKIE)?.value;
  if (token)
    await privateQuery("DELETE FROM professional_sessions WHERE token_hash=$1", [digest(token)]);
  jar.delete(PROFESSIONAL_COOKIE);
}
async function legacyAccount(email: string) {
  const [table] = await privateQuery<{ present: string | null }>(
    "SELECT to_regclass('neon_auth.account')::text AS present",
  );
  if (!table?.present) return null;
  const rows = await privateQuery<Account & { role: string }>(
    `SELECT u.id,u.email,u.name,a.password AS password_hash,
  NOT COALESCE(u.banned,false) AS enabled, u.role FROM neon_auth."user" u
  JOIN neon_auth.account a ON a."userId"=u.id AND a."providerId"='credential'
  WHERE lower(u.email)=$1 LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}
export async function authenticate(email: string, password: string) {
  let [account] = await privateQuery<Account>(
    "SELECT * FROM professional_accounts WHERE email=$1",
    [email],
  );
  if (!account) {
    const legacy = await legacyAccount(email);
    if (!legacy || !legacy.enabled || !(await verifyPassword(password, legacy.password_hash)))
      return null;
    // Importa somente após prova da senha; conserva ID e perfil já concedido no servidor.
    await privateTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO professional_accounts(id,email,name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [legacy.id, email, legacy.name, await hashPassword(password)],
      );
      await tx.query(
        `INSERT INTO profiles(user_id,role,office_id) VALUES($1,$2,$3)
    ON CONFLICT(user_id) DO UPDATE SET role=CASE WHEN profiles.role='citizen' THEN excluded.role ELSE profiles.role END,
    office_id=COALESCE(profiles.office_id,excluded.office_id)`,
        [legacy.id, legacy.role === "admin" ? "admin" : "lawyer", OFFICE],
      );
    });
    [account] = await privateQuery<Account>("SELECT * FROM professional_accounts WHERE email=$1", [
      email,
    ]);
  }
  if (!account?.enabled || !(await verifyPassword(password, account.password_hash))) return null;
  await startSession(account.id);
  return account.id;
}
export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  cpfCnpj: string;
  oabNumber: string;
  oabState: string;
  plan: string;
}) {
  const existing = await privateQuery("SELECT id FROM professional_accounts WHERE email=$1", [
    input.email,
  ]);
  if (existing.length || (await legacyAccount(input.email)))
    throw new Error("Este e-mail já possui cadastro. Entre com sua senha na opção Entrar.");
  const id = crypto.randomUUID();
  const hash = await hashPassword(input.password);
  await privateTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO professional_accounts(id,email,name,password_hash,cpf_cnpj,oab_number,oab_state,terms_accepted_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,now())`,
      [id, input.email, input.name, hash, input.cpfCnpj, input.oabNumber, input.oabState],
    );
    await tx.query("INSERT INTO profiles(user_id,role,office_id) VALUES($1,'lawyer',$2)", [
      id,
      OFFICE,
    ]);
    await tx.query("INSERT INTO billing_accounts(lawyer_id,plan_id) VALUES($1,$2)", [
      id,
      input.plan,
    ]);
  });
  await startSession(id);
  return id;
}
