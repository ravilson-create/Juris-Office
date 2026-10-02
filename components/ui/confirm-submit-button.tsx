"use client";

import type { ReactNode } from "react";

/**
 * Botão de submit que pede confirmação antes de enviar o formulário — não existe nenhum
 * diálogo de confirmação no app hoje; este é o primeiro, para ações irreversíveis (excluir).
 */
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
