import { AsyncLocalStorage } from "node:async_hooks";

/** Contexto interno da transação: sempre derivado da Neon Auth ou do cookie httpOnly. */
export type TrustedDbSession = Readonly<{
  userId: string | null;
  anonHash: string | null;
}>;

const dbSession = new AsyncLocalStorage<TrustedDbSession>();

export function runWithDbSession<T>(
  identity: TrustedDbSession,
  callback: () => Promise<T>,
): Promise<T> {
  return dbSession.run(identity, callback);
}

export function currentDbSession(): TrustedDbSession | undefined {
  return dbSession.getStore();
}
