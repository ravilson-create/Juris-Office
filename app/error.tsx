"use client";

import { useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <div className="mx-auto max-w-prose px-5 py-20" role="alert">
      <h1 ref={heading} tabIndex={-1} className="text-3xl focus:outline-none">
        Não foi possível carregar esta página
      </h1>
      <p className="mt-3 text-muted">
        Houve uma falha ao buscar as informações. Suas respostas já salvas não foram perdidas. Tente
        carregar a página novamente.
      </p>
      {error.digest && (
        <p className="mt-3 text-sm text-muted">
          Se o problema continuar, anote este código para a equipe de testes:{" "}
          <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <ButtonLink href="/" variant="secondary">
          Ir para o início
        </ButtonLink>
      </div>
    </div>
  );
}
