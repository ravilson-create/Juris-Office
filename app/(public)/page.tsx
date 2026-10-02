import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { getCaseService } from "@/lib/services";
import { APP_NAME } from "@/lib/config";
import type { LegalAreaSlug } from "@/domain/legal-area/schema";

function IconArea({ slug }: { slug: LegalAreaSlug }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    width: 22,
    height: 22,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (slug) {
    case "consumidor":
      return (
        <svg {...common}>
          <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L20 8H6" />
          <circle cx="9.5" cy="20" r="1.3" />
          <circle cx="16.5" cy="20" r="1.3" />
        </svg>
      );
    case "trabalhista":
      return (
        <svg {...common}>
          <rect x="3.5" y="7.5" width="17" height="11.5" rx="1.5" />
          <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
        </svg>
      );
    case "familia":
      return (
        <svg {...common}>
          <circle cx="8" cy="7" r="2.3" />
          <circle cx="16" cy="7" r="2.3" />
          <path d="M3.5 19v-2a4.5 4.5 0 0 1 4.5-4.5 4.5 4.5 0 0 1 4.5 4.5v2M11.5 19v-1.5a4 4 0 0 1 4-4 4 4 0 0 1 4 4V19" />
        </svg>
      );
    case "previdenciario":
      return (
        <svg {...common}>
          <path d="M12 3.5 4.5 6v5c0 5 3 8.3 7.5 9.5 4.5-1.2 7.5-4.5 7.5-9.5V6L12 3.5Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "civel":
      return (
        <svg {...common}>
          <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" />
          <path d="M9 9h6M9 12.5h6M9 16h4" />
        </svg>
      );
  }
}

export default async function HomePage() {
  const areas = (await getCaseService().listLegalAreas()).filter((a) => a.active);

  return (
    <>
      <section className="border-b border-line bg-paper">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2 md:py-20">
          <div className="flex flex-col items-start gap-6">
            <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-gold-strong">
              Organização · orientação · mais acesso
            </p>
            <h1 className="text-4xl text-ink sm:text-5xl">
              Seu primeiro passo para resolver uma questão jurídica.
            </h1>
            <p className="max-w-prose text-lg text-muted">
              Conte seu problema, organize seus documentos e acompanhe seu atendimento. O{" "}
              {APP_NAME} faz perguntas guiadas e monta um dossiê preliminar — você não precisa
              saber termos jurídicos.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="/atendimento" variant="gold">
                Iniciar atendimento gratuito
              </ButtonLink>
              <ButtonLink href="/atendimento/meus" variant="secondary">
                Consultar meu atendimento
              </ButtonLink>
            </div>
            <p className="text-sm text-muted">
              Sem cadastro para solicitar atendimento. Versão de demonstração — use dados
              fictícios.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink">Acompanhe seu atendimento</h2>
            <ol className="mt-5 flex flex-col gap-5">
              {[
                {
                  titulo: "Relato",
                  texto: "Você conta o que aconteceu, com suas próprias palavras.",
                },
                {
                  titulo: "Dossiê organizado",
                  texto: "O sistema monta um resumo estruturado do seu caso.",
                },
                {
                  titulo: "Protocolo para consultar",
                  texto: "Você guarda o protocolo e retoma quando quiser.",
                },
              ].map((passo, i) => (
                <li key={passo.titulo} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft font-serif text-sm font-semibold text-gold-strong"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-sans font-semibold text-ink">{passo.titulo}</p>
                    <p className="text-sm text-muted">{passo.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14" aria-labelledby="areas-title">
        <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-gold-strong">
          Áreas de atendimento
        </p>
        <h2 id="areas-title" className="sr-only">
          Áreas de atendimento
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {areas.map((area) => (
            <li key={area.id}>
              <Link
                href="/atendimento"
                className="flex h-full flex-col gap-3 rounded-md border border-line bg-surface p-5 transition-colors hover:border-gold-strong"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold-soft text-gold-strong">
                  <IconArea slug={area.slug} />
                </span>
                <span className="font-sans font-semibold text-ink">{area.name}</span>
                <span className="text-sm text-muted">{area.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-navy">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-navy-soft">
              Área advogados
            </p>
            <h2 className="mt-3 text-3xl text-white sm:text-4xl">Seu escritório começa aqui.</h2>
            <p className="mt-3 max-w-prose text-navy-soft">
              Organize atendimentos, documentos e a rotina jurídica.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-4 text-sm text-navy-soft sm:flex-row sm:gap-8">
              <p>Gerencie solicitações em um só lugar</p>
              <p>Acompanhe prazos e andamentos</p>
              <p>Mais organização para o seu atendimento</p>
            </div>
            <ButtonLink href="/advogado" variant="gold">
              Conhecer planos
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="max-w-prose rounded-md border border-line bg-surface p-6">
          <h2 className="text-xl">O que esta plataforma faz e o que não faz</h2>
          <p className="mt-3 text-muted">
            O {APP_NAME} organiza as informações que você digita e gera um dossiê preliminar para o
            advogado responsável pelo seu caso. Ele <strong>não</strong> emite parecer jurídico,
            não promete resultado e não substitui a orientação de um profissional habilitado.
          </p>
        </div>
      </section>
    </>
  );
}
