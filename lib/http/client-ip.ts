import "server-only";
import { headers } from "next/headers";

/**
 * IP de quem fez a requisição, a partir dos cabeçalhos que a Vercel (e proxies compatíveis)
 * preenchem. Sem eles (ex.: `next dev` local), cai num valor fixo — nunca lança erro.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "desconhecido";
}
