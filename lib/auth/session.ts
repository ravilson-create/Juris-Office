/** Importação tardia: testes sem Neon Auth não carregam o SDK Next.js. */
export const authEnabled = Boolean(
  process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET,
);

export function assertAuthConfiguration(): void {
  if (Boolean(process.env.NEON_AUTH_BASE_URL) !== Boolean(process.env.NEON_AUTH_COOKIE_SECRET)) {
    throw new Error("Configuração incompleta da Neon Auth.");
  }
  if (authEnabled && (process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0) < 32) {
    throw new Error("NEON_AUTH_COOKIE_SECRET precisa ter ao menos 32 caracteres.");
  }
}

export async function currentUserId(): Promise<string | null> {
  return (await currentIdentity())?.id ?? null;
}

export async function currentIdentity(): Promise<{
  id: string;
  email: string;
  emailVerified: boolean;
} | null> {
  if (!authEnabled) return null;
  const { getAuth } = await import("./server");
  // Leitura passiva: o SDK Neon Auth pode tentar renovar cookies na leitura normal,
  // o que o Next.js proíbe em Server Components/layouts (Neon issue #196).
  // A renovação continua reservada a ações/rotas de autenticação.
  const { data } = await getAuth().getSession({ query: { disableRefresh: "true" } });
  return data?.user
    ? {
        id: data.user.id,
        email: data.user.email,
        emailVerified: data.user.emailVerified,
      }
    : null;
}
