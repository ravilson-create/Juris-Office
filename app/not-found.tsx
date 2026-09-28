import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-prose px-5 py-20">
      <h1 className="text-3xl">Página ou atendimento não encontrado</h1>
      <p className="mt-3 text-muted">
        O endereço pode estar incorreto ou o atendimento expirou. Nesta versão de testes os
        atendimentos são apagados quando o servidor reinicia.
      </p>
      <ButtonLink href="/atendimento" className="mt-8">
        Iniciar novo atendimento
      </ButtonLink>
    </div>
  );
}
