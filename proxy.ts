import { NextResponse, type NextRequest } from "next/server";
import { basicAuthConfigured, isBasicAuthValid } from "@/lib/auth/basic-auth";

const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP com nonce por requisição em script-src: troca o 'unsafe-inline' por um valor aleatório,
 * válido só nesta resposta. O Next.js lê o nonce do cabeçalho da própria requisição (ver
 * `x-nonce` abaixo) e o aplica sozinho aos scripts que ele mesmo injeta na hidratação.
 * `style-src` continua com 'unsafe-inline': o Next injeta alguns estilos inline (build interno)
 * sem propagar nonce a eles, e o risco de um estilo injetado é bem menor que o de um script.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Se BASIC_AUTH_USER/BASIC_AUTH_PASSWORD estiverem definidos, exige usuário e senha em todas as
 * páginas. A verificação de saúde (/api/saude) fica aberta para a hospedagem monitorar o app.
 */
export async function proxy(request: NextRequest) {
  if (basicAuthConfigured() && request.nextUrl.pathname !== "/api/webhooks/asaas") {
    const ok = await isBasicAuthValid(
      request.headers.get("authorization"),
      process.env.BASIC_AUTH_USER!,
      process.env.BASIC_AUTH_PASSWORD!,
    );
    if (!ok) {
      return new NextResponse("Acesso restrito ao ambiente de testes.", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Juris Office IA (testes)", charset="UTF-8"',
          "Cache-Control": "no-store",
        },
      });
    }
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (/^\/(consulta|atendimento|equipe|auth|assinatura)(\/|$)/.test(request.nextUrl.pathname)) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/saude|_next/static|_next/image|icon.png|apple-icon.png|brand/).*)"],
};
