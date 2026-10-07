import { getMaintenanceDb } from "@/lib/db/connection";

/**
 * Recebe eventos de pagamento do Asaas e atualiza o status da assinatura correspondente.
 * Quem chama é o Asaas, não uma sessão de usuário — autenticado pelo header
 * `asaas-access-token` (nome fixado pelo próprio Asaas) contra ASAAS_WEBHOOK_TOKEN. Usa a
 * conexão de manutenção (dono do esquema) porque a atualização é por external_ref/gateway, sem
 * app.user_id de sessão — a RLS de lawyer_subscriptions bloquearia uma conexão comum aqui.
 */
const EVENTO_PARA_STATUS: Record<string, string> = {
  PAYMENT_CONFIRMED: "active",
  PAYMENT_RECEIVED: "active",
  PAYMENT_OVERDUE: "past_due",
  SUBSCRIPTION_DELETED: "canceled",
};

export async function POST(request: Request): Promise<Response> {
  const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
  const tokenRecebido = request.headers.get("asaas-access-token");
  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return Response.json({ erro: "Não autenticado." }, { status: 401 });
  }

  // Sempre devolve 200 (mesmo para evento não mapeado ou erro interno): o Asaas reenvia o
  // mesmo webhook várias vezes se não receber 200, e um evento que não tratamos só geraria
  // retries inúteis. O console.error registra o problema para investigação nos logs.
  try {
    const body = (await request.json()) as {
      event?: string;
      payment?: { subscription?: string; invoiceUrl?: string; dueDate?: string };
    };
    const evento = body?.event;
    const subscriptionId = body?.payment?.subscription;
    if (!subscriptionId) return Response.json({ ok: true });

    const db = getMaintenanceDb();
    if (evento === "SUBSCRIPTION_DELETED") {\n      // O cancelamento no gateway interrompe cobranças futuras, mas não encerra o período já pago.\n      // A assinatura só deixa de dar acesso quando valid_until expirar.\n      await db.query(\n        `UPDATE lawyer_subscriptions SET cancelar_em_renovacao = true,\n           cancellation_requested_at = COALESCE(cancellation_requested_at, now()), updated_at = now()\n         WHERE external_ref = $1`,\n        [subscriptionId],\n      );\n    } else if (evento === "PAYMENT_CREATED") {
      await db.query(
        `UPDATE lawyer_subscriptions SET invoice_url = $2, updated_at = now()
         WHERE external_ref = $1`,
        [subscriptionId, body?.payment?.invoiceUrl ?? null],
      );
    } else {
      const status = evento ? EVENTO_PARA_STATUS[evento] : undefined;
      if (status) {
        await db.query(
          `UPDATE lawyer_subscriptions SET status = $2, updated_at = now(),
             invoice_url = CASE WHEN $2 = 'active' THEN NULL ELSE invoice_url END,
             valid_until = CASE WHEN $2 = 'active' AND $3::timestamptz IS NOT NULL
               THEN $3::timestamptz ELSE valid_until END
           WHERE external_ref = $1`,
          [subscriptionId, status, body?.payment?.dueDate ?? null],
        );
      }
    }
    await db.close();
  } catch (error) {
    console.error("[webhooks/asaas]", error);
  }
  return Response.json({ ok: true });
}
