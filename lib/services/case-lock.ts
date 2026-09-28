/**
 * Trava por atendimento: operações que alteram o mesmo caso rodam uma de cada vez,
 * na ordem de chegada — inclusive quando vêm de abas diferentes.
 *
 * Alcance: um único processo do servidor (como o armazenamento mock). Não substitui
 * transações, bloqueio de linha (SELECT … FOR UPDATE) e restrições do banco, que serão a
 * garantia em produção (F5). Por isso a finalização também verifica a revisão do caso de
 * forma atômica na persistência.
 */
export interface CaseLock {
  run<T>(caseId: string, fn: () => Promise<T>): Promise<T>;
}

export class InProcessCaseLock implements CaseLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  async run<T>(caseId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(caseId) ?? Promise.resolve();
    // Continua a fila mesmo se a operação anterior falhou.
    const result = previous.catch(() => undefined).then(fn);
    const tail = result.catch(() => undefined);
    this.tails.set(caseId, tail);
    try {
      return await result;
    } finally {
      // Libera a memória quando ninguém mais está na fila deste caso.
      if (this.tails.get(caseId) === tail) this.tails.delete(caseId);
    }
  }
}

const globalForLock = globalThis as unknown as { __jurisOfficeCaseLock?: InProcessCaseLock };

/** Instância única do processo (sobrevive ao hot reload do `next dev`). */
export function getProcessCaseLock(): InProcessCaseLock {
  globalForLock.__jurisOfficeCaseLock ??= new InProcessCaseLock();
  return globalForLock.__jurisOfficeCaseLock;
}
