import { NextResponse } from "next/server";
import { getMaintenanceDb, hasDatabase } from "@/lib/db/connection";
import { runRetentionCleanup } from "@/lib/services/retention";
import { escalonarPrazosVencidos } from "@/lib/services/equipe-prazos";
import { escalonarParcelasVencidas } from "@/lib/services/equipe-contratos";

export const dynamic = "force-dynamic";

/**
 * Chamado pelo Vercel Cron (ver vercel.json). Protegido por CRON_SECRET — nunca confiar em IP
 * de origem, já que a rota é pública. Sem o segredo configurado, recusa sempre (fecha por padrão).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "não autorizado" }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ status: "sem banco: nada a limpar" });
  }
  const db = getMaintenanceDb();
  try {
    const result = await runRetentionCleanup(db);
    const prazosEscalados = await escalonarPrazosVencidos(db);
    const parcelasEscaladas = await escalonarParcelasVencidas(db);
    return NextResponse.json({ status: "ok", ...result, prazosEscalados, parcelasEscaladas });
  } finally {
    await db.close();
  }
}
