"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraftAction } from "@/app/atendimento/actions";

export type DraftState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string }
  | { kind: "stale" }
  | { kind: "locked" };

const DEBOUNCE_MS = 1200;
const RETRY_MS = 8000;

/**
 * Salva rascunho no servidor enquanto a pessoa preenche.
 * - Espera uma pausa na digitação (debounce) e mantém no máximo uma requisição por vez;
 *   se houver mudança durante o envio, envia de novo ao terminar, sempre com o estado mais
 *   recente. A sequência (`seq`) permite ao servidor descartar respostas fora de ordem.
 * - `stop()` aguarda o envio em andamento e desliga o salvamento: usado antes de salvar a
 *   parte oficialmente, para nenhum rascunho atrasado chegar depois.
 * - Avisa ao sair da página (beforeunload) enquanto houver alteração não salva.
 * Nada é gravado no armazenamento do navegador.
 */
export function useDraftAutosave({
  caseId,
  scope,
  baseTime,
  values,
}: {
  caseId: string;
  scope: string;
  baseTime: string;
  values: unknown;
}) {
  const [state, setState] = useState<DraftState>({ kind: "idle" });
  const formKey = useRef<string>(crypto.randomUUID());
  const seq = useRef(0);
  const lastSaved = useRef<string>(JSON.stringify(values));
  const latest = useRef<string>(lastSaved.current);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const stopped = useRef(false);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (stopped.current) return;
    if (inFlight.current) {
      await inFlight.current;
      return flush();
    }
    const snapshot = latest.current;
    if (snapshot === lastSaved.current) return;
    setState({ kind: "saving" });
    seq.current += 1;
    const run = (async () => {
      try {
        const r = await saveDraftAction(caseId, scope, JSON.parse(snapshot), {
          formKey: formKey.current,
          seq: seq.current,
          baseTime,
        });
        if (r.ok && r.status === "saved") {
          lastSaved.current = snapshot;
          setState(
            latest.current === snapshot ? { kind: "saved", at: r.savedAt } : { kind: "dirty" },
          );
        } else if (r.ok) {
          stopped.current = true;
          setState({ kind: "stale" });
        } else if (r.reason === "locked") {
          stopped.current = true;
          setState({ kind: "locked" });
        } else {
          setState({ kind: "error", message: r.message });
          timer.current = setTimeout(() => void flush(), RETRY_MS);
        }
      } catch {
        // Falha de rede: o conteúdo continua no formulário; tenta de novo depois.
        setState({ kind: "error", message: "Sem conexão com o servidor." });
        timer.current = setTimeout(() => void flush(), RETRY_MS);
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (!stopped.current && latest.current !== lastSaved.current) {
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    }
  }, [baseTime, caseId, scope]);

  const serialized = JSON.stringify(values);
  useEffect(() => {
    latest.current = serialized;
    if (stopped.current || serialized === lastSaved.current) return;
    setState((s) => (s.kind === "saving" ? s : { kind: "dirty" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
  }, [serialized, flush]);

  // Aviso ao fechar/recarregar a aba com alteração não salva.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stopped.current) return;
      if (latest.current !== lastSaved.current || inFlight.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  /** Antes da gravação oficial: espera o envio em andamento e desliga o rascunho. */
  const stop = useCallback(async () => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current.catch(() => undefined);
  }, []);

  /** Religa após uma gravação oficial que falhou (o conteúdo segue no formulário). */
  const resume = useCallback(() => {
    stopped.current = false;
    if (latest.current !== lastSaved.current) {
      timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    }
  }, [flush]);

  return { state, stop, resume, retry: flush };
}
