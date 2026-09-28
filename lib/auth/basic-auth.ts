/**
 * Proteção opcional do ambiente de testes por usuário e senha (HTTP Basic), ativada apenas
 * quando BASIC_AUTH_USER e BASIC_AUTH_PASSWORD estão definidos. Serve para manter o site de
 * demonstração fora do alcance de qualquer pessoa da internet. NÃO é a autenticação do produto
 * (contas, papéis e RLS chegam na fase F5).
 * Compatível com o runtime do middleware (Web Crypto, sem módulos do Node).
 */
async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(digest);
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function basicAuthConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD);
}

/** Compara usuário e senha pelo hash, em tempo constante, sem revelar qual campo errou. */
export async function isBasicAuthValid(
  header: string | null,
  user: string,
  password: string,
): Promise<boolean> {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(
      Uint8Array.from(atob(header.slice(6).trim()), (c) => c.charCodeAt(0)),
    );
  } catch {
    return false;
  }
  const at = decoded.indexOf(":");
  if (at < 0) return false;
  const [gotUser, gotPass, wantUser, wantPass] = await Promise.all([
    sha256(decoded.slice(0, at)),
    sha256(decoded.slice(at + 1)),
    sha256(user),
    sha256(password),
  ]);
  return equalBytes(gotUser, wantUser) && equalBytes(gotPass, wantPass);
}
