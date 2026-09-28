import { NextResponse } from "next/server";
import { getDb, hasDatabase } from "@/lib/db/connection";

export const dynamic = "force-dynamic";

/** Verificação de saúde: sem dados pessoais e sem detalhes internos na resposta. */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!hasDatabase()) {
    // Produção sem banco (e sem autorização explícita para memória) é configuração errada.
    const misconfigured =
      process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_STORE !== "1";
    return misconfigured
      ? NextResponse.json({ status: "sem_banco" }, { status: 503, headers })
      : NextResponse.json({ status: "ok", banco: "memoria" }, { headers });
  }
  try {
    await getDb().query("SELECT 1");
    return NextResponse.json({ status: "ok", banco: "postgresql" }, { headers });
  } catch {
    return NextResponse.json({ status: "indisponivel" }, { status: 503, headers });
  }
}
