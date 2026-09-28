import { NextResponse, type NextRequest } from "next/server";
import { basicAuthConfigured, isBasicAuthValid } from "@/lib/auth/basic-auth";

/**
 * Se BASIC_AUTH_USER/BASIC_AUTH_PASSWORD estiverem definidos, exige usuário e senha em todas as
 * páginas. A verificação de saúde (/api/saude) fica aberta para a hospedagem monitorar o app.
 * Sem as variáveis, não faz nada.
 */
export async function middleware(request: NextRequest) {
  if (!basicAuthConfigured()) return NextResponse.next();
  const ok = await isBasicAuthValid(
    request.headers.get("authorization"),
    process.env.BASIC_AUTH_USER!,
    process.env.BASIC_AUTH_PASSWORD!,
  );
  if (ok) return NextResponse.next();
  return new NextResponse("Acesso restrito ao ambiente de testes.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Juris Office IA (testes)", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!api/saude|_next/static|_next/image|icon.png|apple-icon.png|brand/).*)"],
};
