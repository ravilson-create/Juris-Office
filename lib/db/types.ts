/** Acesso mínimo ao banco: suficiente para os repositórios e independente do driver. */
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  /** Executa `fn` numa transação: COMMIT se resolver, ROLLBACK se lançar. */
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

/** Códigos de erro do PostgreSQL usados pelos repositórios. */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

export function pgErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}
