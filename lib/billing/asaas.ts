import "server-only";
const SANDBOX = "https://api-sandbox.asaas.com/v3";
export function sandboxConfigured() {
  return Boolean(process.env.ASAAS_SANDBOX_API_KEY);
}
export async function asaas<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const key = process.env.ASAAS_SANDBOX_API_KEY;
  if (!key) throw new Error("Asaas sandbox ainda não configurado pelo administrador.");
  const res = await fetch(`${SANDBOX}${path}`, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "JurisOffice-Sandbox/1.0",
      access_token: key,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok)
    throw new Error(
      "Não foi possível concluir a operação no Asaas sandbox. Confira os dados ou tente novamente.",
    );
  return (await res.json()) as T;
}
export type Payment = {
  id: string;
  subscription: string;
  status: string;
  dueDate: string;
  value: number;
  invoiceUrl?: string;
};
export async function payments(subscriptionId: string) {
  const result: Payment[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await asaas<{ data: Payment[]; hasMore: boolean }>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=100&offset=${offset}`,
    );
    result.push(...page.data);
    if (!page.hasMore) return result;
  }
  throw new Error("Histórico de cobrança excede o limite de conciliação.");
}
export function safeInvoiceUrl(value?: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      ["sandbox.asaas.com", "www.asaas.com", "asaas.com"].includes(u.hostname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
