import "server-only";
import { createAuthClient } from "@neondatabase/auth";
import { getDb } from "@/lib/db/connection";

/**
 * Cria uma conta Neon Auth para outra pessoa sem tocar nos cookies da sessão do administrador.
 *
 * IMPORTANTE: não use getAuth().signUp.email() neste fluxo. O adaptador Next.js integra cookies
 * à resposta da requisição e poderia substituir a sessão do administrador pela sessão da conta
 * recém-criada. O cliente oficial abaixo fala diretamente com o Managed Neon Auth e mantém a
 * sessão do administrador isolada.
 */
export async function criarContaEquipe(params: {
  email: string;
  password: string;
  name: string;
}): Promise<{ userId: string } | { error: string }> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) return { error: "Neon Auth não configurada." };

  try {
    const auth = createAuthClient(baseUrl);
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "https://juris-office-eta.vercel.app";
    const origin = new URL(appOrigin).origin;
    const result = await auth.signUp.email(
      {
        ...params,
        callbackURL: `${origin}/equipe/time`,
      },
      {
        headers: {
          Origin: origin,
        },
      },
    );

    if (result.error) {
      console.error("[equipe] Neon Auth recusou criação de membro", {
        status: result.error.status,
        statusText: result.error.statusText,
        code: result.error.code,
        message: result.error.message,
      });
      return {
        error: result.error.message || "Não foi possível criar a conta.",
      };
    }

    const userId = result.data?.user?.id;
    if (typeof userId !== "string" || !userId) {
      console.error("[equipe] Neon Auth criou conta sem retornar user.id");
      return { error: "Não foi possível confirmar a criação da conta." };
    }

    // Contas criadas pelo administrador do escritório são provisionadas e ativadas diretamente.
    // O Neon Auth mantém require_email_verification para o cadastro público; por isso marcamos
    // somente este usuário administrativo como verificado antes de liberar o primeiro login.
    await getDb().query(
      'UPDATE neon_auth."user" SET "emailVerified" = true, "updatedAt" = now() WHERE id = $1',
      [userId],
    );

    return { userId };
  } catch (error) {
    console.error("[equipe] falha ao criar conta no Neon Auth", error);
    return { error: "Não foi possível criar a conta agora. Tente novamente." };
  }
}
