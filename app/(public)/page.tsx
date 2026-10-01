import { ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

export default function HomePage() {
  return (
    <>
      <section className="grid md:grid-cols-2">
        <div className="flex flex-col items-center justify-center gap-6 bg-navy px-6 py-16 text-center sm:px-10 md:min-h-[32rem] md:py-20">
          <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-navy-soft">
            Para você
          </p>
          <h1 className="max-w-md text-4xl text-white sm:text-5xl">
            Seu problema jurídico, organizado em um dossiê.
          </h1>
          <p className="max-w-sm text-lg text-navy-soft">
            O {APP_NAME} faz perguntas guiadas e monta um dossiê preliminar com o que você
            informou. Você não precisa saber termos jurídicos.
          </p>
          <ButtonLink href="/atendimento" variant="inverse-navy">
            Iniciar atendimento de teste
          </ButtonLink>
          <p className="text-sm text-navy-soft">
            Leva cerca de 10 minutos, sem cadastro. Use dados fictícios.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-6 bg-teal px-6 py-16 text-center sm:px-10 md:min-h-[32rem] md:py-20">
          <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-teal-soft">
            Para advogados
          </p>
          <h1 className="max-w-md text-4xl text-white sm:text-5xl">
            Os casos do seu escritório, em um só lugar.
          </h1>
          <p className="max-w-sm text-lg text-teal-soft">
            Acompanhe dossiês, gere petições iniciais pré-preenchidas e organize a fila de
            atendimento do escritório.
          </p>
          <ButtonLink href="/advogado" variant="inverse-teal">
            Área do advogado
          </ButtonLink>
          <p className="text-sm text-teal-soft">7 dias grátis, sem cartão.</p>
        </div>
      </section>

      <section className="border-b border-line bg-surface py-4 text-center">
        <ButtonLink href="/como-funciona" variant="ghost">
          Como funciona
        </ButtonLink>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12">
        <div className="max-w-prose rounded-md border border-line bg-surface p-6">
          <h2 className="text-xl">O que esta plataforma faz e o que não faz</h2>
          <p className="mt-3 text-muted">
            Nesta versão de testes, o {APP_NAME} organiza as informações que você digita e gera um
            dossiê preliminar para demonstração. Ele <strong>não</strong> encaminha nada a
            advogados, não recebe arquivos, não emite parecer jurídico, não promete resultado e não
            substitui a orientação de um profissional habilitado.
          </p>
        </div>
      </section>
    </>
  );
}
