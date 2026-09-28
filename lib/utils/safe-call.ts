import type { ServiceResult } from "@/lib/services/errors";

export const NETWORK_ERROR_MESSAGE =
  "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo; o que você preencheu nesta página continua aqui.";

/**
 * Chama uma Server Action a partir do navegador tratando falhas de rede
 * (conexão caída, servidor reiniciando), que de outra forma virariam exceções sem mensagem.
 */
export async function safeCall<T>(fn: () => Promise<ServiceResult<T>>): Promise<ServiceResult<T>> {
  try {
    return await fn();
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}
