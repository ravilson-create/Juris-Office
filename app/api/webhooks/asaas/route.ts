import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { handleBillingEvent } from "@/lib/billing/service";
export async function POST(request: Request) {
  const secret = process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN;
  const actual = request.headers.get("asaas-access-token") ?? "";
  if (
    !secret ||
    secret.length < 32 ||
    Buffer.byteLength(secret) !== Buffer.byteLength(actual) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(actual))
  )
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 100000) return Response.json({ error: "Payload inválido" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = z
    .object({
      id: z.string().min(1).max(200),
      event: z.string().max(100),
      payment: z.object({ subscription: z.string().max(100).optional() }).optional(),
      subscription: z.object({ id: z.string().max(100) }).optional(),
    })
    .safeParse(body);
  if (!parsed.success) return Response.json({ error: "Evento inválido" }, { status: 400 });
  const e = parsed.data;
  const id = e.payment?.subscription ?? e.subscription?.id;
  if (!id) return Response.json({ ok: true });
  try {
    await handleBillingEvent(e.id, e.event, id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Reentrega necessária" }, { status: 503 });
  }
}
