"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Força uma releitura do servidor ao voltar/avançar pelo navegador. Sem isso, "voltar" depois de
 * salvar oficialmente uma etapa reaproveita o cache do roteador do Next (RSC) de antes da
 * gravação — por exemplo, "rascunho restaurado" reaparecendo mesmo já tendo sido salvo, porque a
 * página em cache não sabe que o rascunho virou gravação oficial nesse meio tempo. `Cache-Control:
 * no-store` (ver next.config.ts) não evita esse reaproveitamento, que acontece só no cliente.
 * Escopo: só as páginas de atendimento, onde mostrar dado desatualizado é enganoso.
 */
export function BfcacheGuard() {
  const router = useRouter();
  useEffect(() => {
    const onPopState = () => router.refresh();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);
  return null;
}
