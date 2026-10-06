import "server-only";
import { createAuthClient } from "@neondatabase/auth";

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
    const result = await auth.signUp.email(params);

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

    return { userId };
  } catch (error) {
    console.error("[equipe] falha ao criar conta no Neon Auth", error);
    return { error: "Não foi possível criar a conta agora. Tente novamente." };
  }
}
