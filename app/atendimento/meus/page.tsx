import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { CASE_STATUS_LABEL, isDeletable } from "@/domain/case/status";
import { formatInstantDateTime } from "@/domain/time";
import { currentSessionHash } from "@/lib/auth/case-access";
import { getCaseService } from "@/lib/services";
import type { MyCaseItem } from "@/lib/services/case-service";
import { authEnabled } from "@/lib/auth/session";
import { signOut } from "@/app/auth/actions";
import {
  arquivarAtendimentoAction,
  desarquivarAtendimentoAction,
  excluirAtendimentoAction,
} from "@/app/atendimento/actions";

export const metadata: Metadata = { title: "Meus atendimentos" };
export const dynamic = "force-dynamic";

export default async function MeusAtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  // Sem sessão não há o que listar; a sessão nunca é criada só por visitar esta página.
  const owner = await currentSessionHash();
  const todos = owner ? await getCaseService().listMyCases(owner) : [];
  const items = todos.filter((item) => !item.archived);
  const arquivados = todos.filter((item) => item.archived);
  const { erro } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl">Meus atendimentos</h1>
      <p className="mt-2 max-w-prose text-muted">
        Atendimentos iniciados {authEnabled ? "na sua conta" : "neste navegador"}. Aqui você retoma
        um rascunho ou abre o protocolo e o dossiê de um atendimento finalizado.
      </p>

      {erro === "nao_excluivel" && (
        <div className="mt-6">
          <Alert tone="error" title="Não foi possível excluir">
            Este atendimento já foi aceito ou está em andamento e não pode mais ser excluído.
          </Alert>
        </div>
      )}

      {!authEnabled && (
        <div className="mt-6">
          <Alert title="Onde estes dados ficam">
            A lista depende de um cookie deste navegador: limpar os cookies, usar navegação anônima
            ou trocar de navegador ou aparelho impede a retomada.
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
          <p className="mt-2 text-muted">Quando você iniciar um atendimento, ele aparecerá aqui.</p>
          <div className="mt-4">
            <ButtonLink href="/atendimento">Iniciar atendimento</ButtonLink>
          </div>
        </section>
      ) : (
        <>
          <ul className="mt-8 flex flex-col gap-4" aria-label="Atendimentos deste navegador">
            {items.map((item) => (
              <AtendimentoItem key={item.id} item={item} />
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink href="/atendimento" variant="secondary">
              Iniciar novo atendimento
            </ButtonLink>
          </div>
        </>
      )}

      {arquivados.length > 0 && (
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-xl">Arquivados</h2>
          <p className="mt-1 text-sm text-muted">
            Ocultos da lista acima, mas nenhum dado foi apagado — desarquive para voltar a vê-los.
          </p>
          <ul className="mt-4 flex flex-col gap-4" aria-label="Atendimentos arquivados">
            {arquivados.map((item) => (
              <AtendimentoItem key={item.id} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AtendimentoItem({ item }: { item: MyCaseItem }) {
  return (
    <li className="rounded-md border border-line bg-surface p-5">
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
        <form action={item.archived ? desarquivarAtendimentoAction : arquivarAtendimentoAction}>
          <input type="hidden" name="caseId" value={item.id} />
          <button
            type="submit"
            className="rounded border border-line px-3 py-2 text-sm font-medium hover:border-navy"
          >
            {item.archived ? "Desarquivar" : "Arquivar"}
          </button>
        </form>
        {isDeletable(item.status) && (
          <form action={excluirAtendimentoAction}>
            <input type="hidden" name="caseId" value={item.id} />
            <ConfirmSubmitButton
              confirmMessage={`Excluir o atendimento ${item.protocol}? Essa ação não pode ser desfeita.`}
              className="rounded border border-danger px-3 py-2 text-sm text-danger hover:bg-danger-soft"
            >
              Excluir
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </li>
  );
}
