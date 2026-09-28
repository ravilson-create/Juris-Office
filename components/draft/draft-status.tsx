"use client";

import { formatInstantDateTime } from "@/domain/time";
import type { DraftState } from "./use-draft-autosave";

/** Estado real do rascunho, anunciado por leitores de tela (aria-live). */
export function DraftStatus({ state, onRetry }: { state: DraftState; onRetry: () => void }) {
  let text = "";
  let tone = "text-muted";
  switch (state.kind) {
    case "dirty":
      text = "Alterações ainda não salvas.";
      break;
    case "saving":
      text = "Salvando rascunho…";
      break;
    case "saved":
      text = `Rascunho salvo às ${formatInstantDateTime(state.at).split(" às ")[1] ?? ""}. Ele não conclui esta parte: use o botão abaixo para salvar e continuar.`;
      break;
    case "error":
      text = `Não foi possível salvar o rascunho (${state.message}). O que você digitou continua aqui.`;
      tone = "text-danger font-medium";
      break;
    case "stale":
      text =
        "Esta parte foi salva em outra aba ou janela. Recarregue a página para ver a versão mais recente.";
      tone = "text-danger font-medium";
      break;
    case "locked":
      text = "O atendimento foi finalizado; alterações não são mais salvas.";
      tone = "text-danger font-medium";
      break;
  }
  return (
    <div className="min-h-6 text-sm" data-testid="estado-rascunho">
      <p role="status" aria-live="polite" className={tone}>
        {text}
      </p>
      {state.kind === "error" && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 font-medium text-navy underline underline-offset-4"
        >
          Tentar salvar o rascunho agora
        </button>
      )}
    </div>
  );
}
