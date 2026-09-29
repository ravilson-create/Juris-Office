import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

import { authEnabled } from "./session";

export function getAuth() {
  if (!authEnabled) throw new Error("Neon Auth não configurada.");
  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    logLevel: "silent",
  });
}
