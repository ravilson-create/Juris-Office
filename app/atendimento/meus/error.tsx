"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function MeusAtendimentosError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10" role="alert">
      <h1 className="text-3xl">Não foi possível carregar seus atendimentos</h1>
      <p className="mt-2 text-muted">Tente novamente.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <ButtonLink href="/atendimento" variant="secondary">
          Iniciar atendimento
        </ButtonLink>
      </div>
    </div>
  );
}
