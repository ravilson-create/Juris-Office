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
      <section className="relative overflow-hidden border-b border-line bg-gradient-to-br from-paper via-white to-sky-50">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="flex flex-col items-start gap-6">
            <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-gold-strong">
              Organização · orientação · mais acesso
            </p>
            <h1 className="text-4xl text-ink sm:text-5xl">
              Advocacia, tecnologia e atendimento em um só lugar.
            </h1>
            <p className="max-w-prose text-lg text-muted">
              Para quem precisa de atendimento, um caminho simples para organizar o problema e acompanhar a solicitação. Para advogados, um ambiente digital para transformar a rotina do escritório.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href="/atendimento" variant="gold">
                Iniciar atendimento gratuito
              </ButtonLink>
              <ButtonLink href="/atendimento/meus" variant="secondary">
                Consultar meu atendimento
              </ButtonLink>
            </div>
            <p className="text-sm text-muted">Sem cadastro para solicitar atendimento.</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-xl shadow-blue-950/10 backdrop-blur">
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

      <section className="bg-gradient-to-r from-navy via-slate-900 to-blue-950">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 md:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-navy-soft">
              Área advogados
            </p>
            <h2 className="mt-3 text-3xl text-white sm:text-4xl">Seu escritório começa aqui.</h2>
            <p className="mt-3 max-w-prose text-navy-soft">
              Um ambiente para centralizar atendimentos, clientes, documentos e a rotina jurídica. 7 dias de teste grátis, sem cartão de crédito — já começam no cadastro.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <ButtonLink href="/advogado/cadastro" variant="gold">
                Começar teste grátis
              </ButtonLink>
              <ButtonLink href="/advogado" variant="secondary">
                Ver planos e preços
              </ButtonLink>
            </div>
          </div>
          <div className="flex flex-col gap-4 text-sm text-navy-soft sm:flex-row sm:gap-8">
            <p>Gerencie solicitações em um só lugar</p>
            <p>Acompanhe prazos e andamentos</p>
            <p>Mais organização para o seu atendimento</p>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <p className="text-center font-sans text-sm font-semibold uppercase tracking-[.08em] text-gold-strong">
            Um escritório jurídico digital
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center text-3xl text-ink sm:text-4xl">
            Seu escritório inteiro em uma plataforma.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted">
            Menos ferramentas dispersas. Mais organização para atender, acompanhar e trabalhar.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Atendimentos", "Organize novas solicitações e informações do cliente."],
              ["Clientes e casos", "Concentre o histórico necessário para acompanhar cada atendimento."],
              ["Documentos", "Mantenha os arquivos relacionados ao trabalho jurídico organizados."],
              ["Rotina jurídica", "Tenha uma visão mais clara das atividades do escritório."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <div className="mb-4 h-1 w-10 rounded-full bg-blue-600" />
                <h3 className="font-sans font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-blue-300">
                Da chegada do cliente ao acompanhamento
              </p>
              <h2 className="mt-3 text-3xl text-white sm:text-4xl">Uma jornada mais organizada.</h2>
              <p className="mt-4 text-slate-300">
                O cidadão informa o problema de forma guiada, recebe seu protocolo e acompanha a solicitação. O advogado recebe informações mais estruturadas para iniciar o trabalho.
              </p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {["Solicitação do cliente", "Triagem guiada", "Dossiê organizado", "Análise do advogado", "Acompanhamento", "Histórico do atendimento"].map((item, i) => (
                <li key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-200">{i + 1}</span>
                  <span className="text-sm font-medium">{item}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-paper">
        <div className="mx-auto grid max-w-6xl gap-5 px-5 py-14 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-7 shadow-sm">
            <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-blue-700">Para advogados</p>
            <h2 className="mt-2 text-2xl text-ink">Transforme a rotina do seu escritório.</h2>
            <p className="mt-3 text-muted">Centralize o trabalho e tenha um ambiente profissional para organizar a operação jurídica.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/advogado/cadastro" variant="gold">Começar teste grátis</ButtonLink>
              <ButtonLink href="/advogado" variant="secondary">Entrar como advogado</ButtonLink>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-7 shadow-sm">
            <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-gold-strong">Para clientes</p>
            <h2 className="mt-2 text-2xl text-ink">Precisa de atendimento jurídico?</h2>
            <p className="mt-3 text-muted">Conte o que aconteceu sem precisar dominar termos jurídicos e acompanhe a solicitação pelo protocolo.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/atendimento" variant="gold">Solicitar atendimento</ButtonLink>
              <ButtonLink href="/atendimento/meus" variant="secondary">Consultar protocolo</ButtonLink>
            </div>
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
