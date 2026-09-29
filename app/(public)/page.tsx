import { BrandSymbol } from "@/components/brand/brand-logo";
import { ButtonLink } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

const PATH = [
  { title: "Escolha o assunto", text: "Consumidor, trabalho, família, INSS ou questões cíveis." },
  { title: "Responda perguntas simples", text: "Uma etapa por vez. Você pode voltar e corrigir." },
  { title: "Conte o que aconteceu", text: "Com suas palavras, e indique os documentos que tiver." },
  {
    title: "Gere o dossiê",
    text: "Um resumo organizado do caso, com protocolo, para você conferir.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-5xl gap-12 px-5 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div className="flex flex-col justify-center gap-6">
            <BrandSymbol height={128} priority className="h-24 w-auto self-start sm:h-32" />
            <h1 className="text-4xl text-ink sm:text-5xl">
              Seu problema jurídico, organizado em um dossiê.
            </h1>
            <p className="max-w-prose text-lg text-muted">
              O {APP_NAME} faz perguntas guiadas e monta um dossiê preliminar com o que você
              informou. Você não precisa saber termos jurídicos.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="/atendimento">Iniciar atendimento de teste</ButtonLink>
              <ButtonLink href="/como-funciona" variant="ghost">
                Como funciona
              </ButtonLink>
              <ButtonLink href="/advogado" variant="ghost">
                Área do advogado
              </ButtonLink>
            </div>
            <p className="text-sm text-muted">
              Versão de demonstração: use dados fictícios. Leva cerca de 10 minutos, sem cadastro.
            </p>
          </div>

          <ol
            aria-label="Como é o atendimento"
            className="relative flex flex-col gap-7 border-l-2 border-line pl-8"
          >
            {PATH.map((step, i) => (
              <li key={step.title} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[45px] top-0 flex h-7 w-7 items-center justify-center rounded-full font-serif text-sm font-semibold ${
                    i === PATH.length - 1
                      ? "bg-teal-strong text-white"
                      : "border-2 border-navy bg-surface text-navy"
                  }`}
                >
                  {i + 1}
                </span>
                <h2 className="font-sans text-base font-semibold">{step.title}</h2>
                <p className="text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
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
