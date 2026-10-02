import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { CASE_STATUS_LABEL } from "@/domain/case/status";
import { formatInstantDateTime } from "@/domain/time";
import { currentSessionHash } from "@/lib/auth/case-access";
import { getCaseService } from "@/lib/services";
import { authEnabled } from "@/lib/auth/session";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Meus atendimentos" };
export const dynamic = "force-dynamic";

export default async function MeusAtendimentosPage() {
  // Sem sessão não há o que listar; a sessão nunca é criada só por visitar esta página.
  const owner = await currentSessionHash();
  const items = owner ? await getCaseService().listMyCases(owner) : [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl">Meus atendimentos</h1>
      <p className="mt-2 max-w-prose text-muted">
        Atendimentos de teste iniciados {authEnabled ? "na sua conta" : "neste navegador"}. Aqui
        você retoma um rascunho ou abre o protocolo e o dossiê de um atendimento finalizado. Esta
        lista não é acompanhamento por advogado: nenhuma informação é encaminhada a um escritório.
      </p>

      {!authEnabled && (
        <div className="mt-6">
          <Alert title="Onde estes dados ficam">
            A lista depende de um cookie deste navegador: limpar os cookies, usar navegação anônima
            ou trocar de navegador ou aparelho impede a retomada. Nesta versão de testes os dados
            ficam só na memória do servidor e são apagados quando ele é reiniciado.
          </Alert>
        </div>
      )}

      {authEnabled && (
        <form action={signOut} className="mt-5">
          <button type="submit" className="rounded border border-line px-3 py-1.5 text-sm font-medium hover:border-navy">
            Sair da conta
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <section
          aria-labelledby="vazio"
          className="mt-8 rounded-md border border-line bg-surface p-6"
        >
          <h2 id="vazio" className="text-xl">
            Nenhum atendimento {authEnabled ? "na sua conta" : "neste navegador"}
          </h2>
          <p className="mt-2 text-muted">
            Quando você iniciar um atendimento de teste, ele aparecerá aqui.
          </p>
          <div className="mt-4">
            <ButtonLink href="/atendimento">Iniciar atendimento de teste</ButtonLink>
          </div>
        </section>
      ) : (
        <>
          <ul className="mt-8 flex flex-col gap-4" aria-label="Atendimentos deste navegador">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border border-line bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-sans text-lg font-semibold">{item.areaName}</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      item.finalized ? "bg-gold-soft text-gold-strong" : "bg-navy-soft text-navy"
                    }`}
                  >
                    {CASE_STATUS_LABEL[item.status]}
                  </span>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Protocolo:</dt>
                    <dd className="font-medium tabular-nums">{item.protocol}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Atualizado em:</dt>
                    <dd>{formatInstantDateTime(item.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-3">
                  <ButtonLink
                    href={item.continueHref}
                    variant={item.finalized ? "secondary" : "primary"}
                    aria-label={`${item.continueLabel} — ${item.areaName}, protocolo ${item.protocol}`}
                  >
                    {item.continueLabel}
                  </ButtonLink>
                  {item.finalized && (
                    <ButtonLink
                      href={`/atendimento/${item.id}/dossie`}
                      variant="ghost"
                      className="border border-line"
                      aria-label={`Abrir dossiê — ${item.areaName}, protocolo ${item.protocol}`}
                    >
                      Abrir dossiê
                    </ButtonLink>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink href="/atendimento" variant="secondary">
              Iniciar novo atendimento de teste
            </ButtonLink>
          </div>
        </>
      )}
    </div>
  );
}
