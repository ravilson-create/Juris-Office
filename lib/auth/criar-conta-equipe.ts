import "server-only";

/**
 * Cria uma conta Neon Auth para outra pessoa — o admin cadastra um membro da equipe direto, sem
 * convite por e-mail nem confirmação por e-mail. Uma chamada normal via getAuth().signUp.email()
 * encaminharia o cookie de sessão da CONTA NOVA para a resposta deste próprio request (o cookie
 * que a Neon Auth devolve é sempre repassado ao navegador de quem fez a chamada), deslogando o
 * admin que está cadastrando e logando-o como a pessoa que ele acabou de criar. Por isso aqui é
 * um fetch cru para o endpoint da Neon Auth, sem ler nem escrever nenhum cookie — só cria a
 * conta. O e-mail fica sem confirmação (emailVerified=false), mas isso nunca bloqueia o login:
 * a única checagem de emailVerified no app é para aceitar convite por e-mail (lib/auth/
 * aceitar-convite.ts), que este fluxo não usa — o perfil já nasce vinculado ao escritório
 * (ver cadastrar_membro_equipe_direto, migração 0031).
 */
export async function criarContaEquipe(params: {
  email: string;
  password: string;
  name: string;
}): Promise<{ userId: string } | { error: string }> {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) return { error: "Neon Auth não configurada." };
  const url = new URL("sign-up/email", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    return { error: "Não foi possível criar a conta agora. Tente novamente." };
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.user?.id !== "string") {
    return {
      error:
        typeof data?.message === "string"
          ? data.message
          : "Não foi possível criar a conta — confira o e-mail e a senha.",
    };
  }
  return { userId: data.user.id };
}
