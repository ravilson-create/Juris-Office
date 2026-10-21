import { ButtonLink } from "@/components/ui/button";

const TRANSCRICAO =
  "Imagine um escritório de advocacia onde cada etapa da rotina flui com clareza e precisão. " +
  "Apresentamos o Júris Office IA: a nova era da advocacia digital. " +
  "Do primeiro contato ao dossiê, o atendimento ao cliente é guiado, organizado e acompanhado em tempo real. " +
  "Contratos de honorários com aceite eletrônico. Petições e peças com exportação em PDF e Word. " +
  "E inteligência artificial que resume e apoia a redação, sempre com a revisão do profissional. " +
  "Prazos, consultas jurídicas e financeiro da equipe, reunidos em um único painel. " +
  "Mais tecnologia. Mais organização. Mais advocacia. " +
  "Experimente grátis por sete dias, em juris-office-ia.vercel.app.";

/**
 * Vídeo de apresentação do sistema (46 s, narrado, vertical 9:16) logo abaixo da área principal da
 * página inicial. Servido pelo próprio site (public/apresentacao): a CSP `default-src 'self'` já
 * cobre `media-src`. `preload="none"` + pôster evita baixar o vídeo de quem não apertar play, e a
 * narração só toca por ação da pessoa (sem autoplay). Legendas em WebVTT e transcrição em texto
 * mantêm o conteúdo acessível.
 */
export function ApresentacaoVideo() {
  return (
    <section className="border-b border-line bg-white" aria-labelledby="apresentacao-video-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-[1fr_auto] md:gap-16 md:py-16">
        <div className="flex flex-col items-start gap-5">
          <p className="font-sans text-sm font-semibold uppercase tracking-[.08em] text-gold-strong">
            Conheça o sistema
          </p>
          <h2 id="apresentacao-video-title" className="text-3xl text-ink sm:text-4xl">
            O Júris Office IA em menos de um minuto.
          </h2>
          <p className="max-w-prose text-lg text-muted">
            Veja como o atendimento ao cliente, os documentos e a rotina do escritório ficam
            organizados em um só lugar, com a revisão do advogado em cada etapa.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="/advogado/cadastro" variant="gold">
              Começar teste grátis
            </ButtonLink>
            <ButtonLink href="#funcionalidades" variant="secondary">
              Ver funcionalidades
            </ButtonLink>
          </div>
          <details className="max-w-prose text-sm text-muted">
            <summary className="cursor-pointer font-semibold text-navy">
              Ler a transcrição do vídeo
            </summary>
            <p className="mt-2 leading-relaxed">{TRANSCRICAO}</p>
          </details>
          <p className="text-xs text-muted">
            Vídeo ilustrativo. Os recursos dependem do perfil de acesso e da configuração de cada
            escritório.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-blue-100 bg-slate-950 shadow-xl shadow-blue-950/15 md:mx-0 md:max-w-[320px]">
          <video
            className="aspect-[9/16] h-auto w-full"
            controls
            playsInline
            preload="none"
            poster="/apresentacao/juris-office-ia-poster.jpg"
            aria-label="Vídeo de apresentação do Júris Office IA, com 46 segundos e narração em português"
          >
            <source src="/apresentacao/juris-office-ia.mp4" type="video/mp4" />
            <track
              kind="captions"
              src="/apresentacao/juris-office-ia.pt-BR.vtt"
              srcLang="pt-BR"
              label="Português (Brasil)"
            />
            Seu navegador não reproduz vídeo. A transcrição está disponível ao lado.
          </video>
        </div>
      </div>
    </section>
  );
}
