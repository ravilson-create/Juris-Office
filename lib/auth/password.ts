import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 67108864 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}
// Compatível com o formato scrypt padrão do Better Auth, para migração no primeiro login.
export async function verifyPassword(password: string, hash: string) {
  const match = /^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash);
  if (!match) return false;
  return timingSafeEqual(await derive(password, match[1]), Buffer.from(match[2], "hex"));
}
