import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Primeira tentativa (região padrão iad1, EUA) levou bloqueio geográfico explícito da CloudFront
// do PJe ("configured to block access from your country"). Fixa a função em São Paulo para testar
// se um IP de saída brasileiro passa.
export const preferredRegion = "gru1";

/**
 * Rota de diagnóstico TEMPORÁRIA — não é feature do produto, só serve para testar, a partir do
 * runtime real da Vercel, se a API do DJEN (comunicaapi.pje.jus.br) responde a uma chamada
 * server-side sem autenticação, ou se bloqueia como o LexML bloqueava (ver lib/external/lexml.ts,
 * removido). Deve ser apagada depois do teste, nunca mesclada à main.
 */
export async function GET() {
  const url = new URL("https://comunicaapi.pje.jus.br/api/v1/comunicacao");
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 7);
  const formatar = (d: Date) => d.toISOString().slice(0, 10);
  url.searchParams.set("dataDisponibilizacaoInicio", formatar(inicio));
  url.searchParams.set("dataDisponibilizacaoFim", formatar(hoje));
  url.searchParams.set("pagina", "1");
  url.searchParams.set("itensPorPagina", "1");

  const tentativas: Record<string, unknown>[] = [];

  for (const comHeaders of [false, true]) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: comHeaders
          ? {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
              Accept: "application/json",
              "Accept-Language": "pt-BR,pt;q=0.9",
            }
          : { Accept: "application/json" },
      });
      const texto = await res.text();
      tentativas.push({
        comHeadersDeNavegador: comHeaders,
        status: res.status,
        contentType: res.headers.get("content-type"),
        pareceJson: texto.trim().startsWith("{") || texto.trim().startsWith("["),
        pareceHtml: /^\s*<!DOCTYPE html/i.test(texto) || /<html[\s>]/i.test(texto.slice(0, 200)),
        primeiros1000Caracteres: texto.slice(0, 1000),
      });
    } catch (erro) {
      tentativas.push({
        comHeadersDeNavegador: comHeaders,
        erroDeRede: erro instanceof Error ? erro.message : String(erro),
      });
    }
  }

  return NextResponse.json({ urlTestada: url.toString(), tentativas }, { headers: { "Cache-Control": "no-store" } });
}
