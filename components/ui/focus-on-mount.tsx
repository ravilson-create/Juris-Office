"use client";

import { useEffect } from "react";

/**
 * Leva a página ao topo e põe o foco no elemento indicado (ex.: título da confirmação).
 * Útil após um envio de formulário, quando o navegador manteria a rolagem anterior.
 */
export function FocusOnMount({ targetId }: { targetId: string }) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.getElementById(targetId)?.focus({ preventScroll: true });
  }, [targetId]);
  return null;
}
