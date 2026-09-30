// A autenticação profissional agora utiliza Server Actions e sessões próprias.
export async function GET() {
  return Response.json({ error: "Use /auth/sign-in" }, { status: 410 });
}
export const POST = GET;
