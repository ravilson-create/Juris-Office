"use client";

import { Button } from "@/components/ui/button";

/** Abre a impressão do navegador, onde também é possível "Salvar como PDF". */
export function PrintButton({ children = "Imprimir ou salvar em PDF" }: { children?: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => window.print()}
      className="print:hidden"
    >
      {children}
    </Button>
  );
}
