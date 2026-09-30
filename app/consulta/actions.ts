"use server";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http/client-ip";
import { lookupTrackingToken, type TrackingResult } from "@/lib/tracking";
export type ConsultState = { error?: string; result?: TrackingResult } | null;
export async function consult(_state: ConsultState, form: FormData): Promise<ConsultState> {
  if (!(await checkRateLimit(`consulta:${await clientIp()}`, 20, 900)))
    return { error: "Muitas consultas. Aguarde 15 minutos." };
  const token = String(form.get("token") ?? "")
    .trim()
    .toUpperCase();
  try {
    const result = await lookupTrackingToken(token);
    return result
      ? { result }
      : { error: "Protocolo inválido ou indisponível. Confira o protocolo recebido ao finalizar." };
  } catch {
    return { error: "Consulta temporariamente indisponível. Tente novamente." };
  }
}
