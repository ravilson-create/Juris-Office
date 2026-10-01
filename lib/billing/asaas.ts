import "server-only";

/**
 * Cliente HTTP para a API do Asaas (gateway de pagamento) — mesmo padrão de lib/asaas.js do
 * fiscal-sinapi-local. Variáveis de ambiente lidas dentro de cada função (não no topo do
 * módulo) para não derrubar o build nem outras rotas quando faltarem.
 */
function baseUrl(): string {
  const url = process.env.ASAAS_API_URL;
  if (!url) throw new Error("ASAAS_API_URL não configurada.");
  return url;
}

function apiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY não configurada.");
  return key;
}

async function chamarAsaas<T>(
  caminho: string,
  body?: unknown,
  method: "GET" | "POST" | "PUT" | "DELETE" = "POST",
): Promise<T> {
  const res = await fetch(`${baseUrl()}${caminho}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": apiKey() },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { errors?: { description?: string }[] })?.errors?.[0]?.description ||
      `Erro ${res.status} na API do Asaas.`;
    throw new Error(msg);
  }
  return data as T;
}

export async function criarClienteAsaas(params: {
  nome: string;
  cpfCnpj: string;
  email: string;
}): Promise<{ id: string }> {
  return chamarAsaas("/customers", {
    name: params.nome,
    cpfCnpj: params.cpfCnpj,
    email: params.email,
  });
}

export async function criarAssinaturaAsaas(params: {
  customerId: string;
  valor: number;
  nextDueDate: string;
  cycle: string;
  descricao: string;
  externalReference: string;
}): Promise<{ id: string }> {
  return chamarAsaas("/subscriptions", {
    customer: params.customerId,
    billingType: "UNDEFINED",
    value: params.valor,
    nextDueDate: params.nextDueDate,
    cycle: params.cycle,
    description: params.descricao,
    externalReference: params.externalReference,
  });
}

export async function cancelarAssinaturaAsaas(subscriptionId: string): Promise<void> {
  await chamarAsaas(`/subscriptions/${subscriptionId}`, undefined, "DELETE");
}

export async function atualizarAssinaturaAsaas(
  subscriptionId: string,
  params: { valor: number },
): Promise<void> {
  await chamarAsaas(`/subscriptions/${subscriptionId}`, { value: params.valor }, "PUT");
}

export async function buscarFaturaAssinaturaAsaas(
  subscriptionId: string,
): Promise<{ invoiceUrl: string; dueDate: string } | null> {
  const data = await chamarAsaas<{
    data?: { status: string; invoiceUrl: string; dueDate: string }[];
  }>(`/subscriptions/${subscriptionId}/payments?limit=20`, undefined, "GET");
  const pendente = (data.data || [])
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  return pendente ? { invoiceUrl: pendente.invoiceUrl, dueDate: pendente.dueDate } : null;
}
