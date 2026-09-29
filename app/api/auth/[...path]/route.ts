import { getAuth } from "@/lib/auth/server";

type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  return getAuth().handler().GET(request, context);
}

export async function POST(request: Request, context: Context) {
  return getAuth().handler().POST(request, context);
}
