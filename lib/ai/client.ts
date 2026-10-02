import "server-only";

/**
 * Mesmo padrão do Orça Valida: o modelo é resolvido pelo Vercel AI Gateway a partir de uma
 * string de ambiente ("provedor/modelo"), nunca instanciado via SDK de provedor específico. Em
 * produção na Vercel a autenticação do Gateway é automática (OIDC); em desenvolvimento local,
 * exige AI_GATEWAY_API_KEY.
 */
export function aiEnabled(): boolean {
  return Boolean(process.env.AI_GATEWAY_MODEL);
}

export function aiModel(): string {
  const model = process.env.AI_GATEWAY_MODEL;
  if (!model) throw new Error("IA não configurada: defina AI_GATEWAY_MODEL.");
  return model;
}
