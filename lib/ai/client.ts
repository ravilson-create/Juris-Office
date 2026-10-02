import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;

/** Construído uma vez por processo — a chave vem de ANTHROPIC_API_KEY (ver .env.example). */
export function getAiClient(): Anthropic {
  if (!aiEnabled()) throw new Error("ANTHROPIC_API_KEY não configurada.");
  client ??= new Anthropic();
  return client;
}
