import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { formatCents } from "@/domain/triage/money";
import {
  adicionarParcelaAction,
  criarContratoAction,
  excluirContratoAction,
  marcarParcelaPagaAction,
  mudarStatusContratoAction,
} from "../../actions";
import {
  listarContratos,
  listarParcelas,
  type ContratoRow,
  type ParcelaRow,
} from "@/lib/services/equipe-contratos";

export const dynamic = "force-dynamic";

const ROTULO_TIPO_HONORARIO: Record<string, string> = {
  fixed: "Valor fixo",
  success: "Honorário de êxito",
  hourly: "Por hora",
  mixed: "Misto (fixo + êxito)",
};
const ROTULO_STATUS_CONTRATO: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado ao cliente",
  signed: "Assinado",
  cancelled: "Cancelado",
};
const ROTULO_STATUS_PARCELA: Record<string, string> = {
  pending: "A vencer",
  paid: "Pago",
  overdue: "Vencido",
};
const MENSAGEM_ERRO: Record<string, string> = {
  contrato_dados: "Preencha o tipo e o valor do honorário corretamente.",
  contrato_percentual: "Percentual de êxito deve estar entre 0 e 100.",
  contrato_transicao: "Essa mudança de status não é permitida a partir do status atual.",
  parcela_dados: "Preencha a data e o valor da parcela corretamente.",
  contrato_nao_excluivel: "Só é possível excluir um contrato em rascunho ou cancelado.",
};

function ContratoCard({ contrato, parcelas }: { contrato: ContratoRow; parcelas: ParcelaRow[] }) {
  const hojeISO = new Date().toISOString().slice(0, 10);
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{ROTULO_TIPO_HONORARIO[contrato.fee_type]}</p>
        <span className="rounded bg-navy-soft px-2 py-1 text-xs text-navy-strong">
          {ROTULO_STATUS_CONTRATO[contrato.status]}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Valor: {formatCents(Number(contrato.fee_value_cents))}
        {contrato.success_percentage && ` · Êxito: ${contrato.success_percentage}%`}
      </p>

      {contrato.status !== "cancelled" && contrato.status !== "signed" && (
        <form action={mudarStatusContratoAction} className="mt-3 flex gap-2">
          <input type="hidden" name="caseId" value={contrato.case_id} />
          <input type="hidden" name="contractId" value={contrato.id} />
          {contrato.status === "draft" && (
            <button
              name="proximoStatus"
              value="sent"
              className="rounded border border-line px-3 py-2 text-sm"
            >
              Marcar como enviado
            </button>
          )}
          <button
            name="proximoStatus"
            value="cancelled"
            className="rounded border border-danger px-3 py-2 text-sm text-danger"
          >
            Cancelar
          </button>
        </form>
      )}

      {(contrato.status === "draft" || contrato.status === "cancelled") && (
        <form action={excluirContratoAction} className="mt-3">
          <input type="hidden" name="caseId" value={contrato.case_id} />
          <input type="hidden" name="contractId" value={contrato.id} />
          <ConfirmSubmitButton
            confirmMessage="Excluir este contrato definitivamente? Essa ação não pode ser desfeita."
            className="rounded border border-danger px-3 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            Excluir contrato
          </ConfirmSubmitButton>
        </form>
      )}

      <h3 className="mt-5 font-semibold">Parcelas</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {parcelas.map((p) => (
          <li
            key={p.id}
            className={`flex items-center justify-between rounded border p-3 ${
              p.status === "overdue" ? "border-danger bg-danger-soft" : "border-line"
            }`}
          >
            <span>
              {new Date(p.due_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} —{" "}
              {formatCents(Number(p.amount_cents))} · {ROTULO_STATUS_PARCELA[p.status]}
            </span>
            {p.status !== "paid" && (
              <form action={marcarParcelaPagaAction}>
                <input type="hidden" name="caseId" value={contrato.case_id} />
                <input type="hidden" name="installmentId" value={p.id} />
                <button className="rounded border border-line px-2 py-1 text-xs">
                  Marcar pago
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {parcelas.length === 0 && <p className="mt-2 text-sm text-muted">Nenhuma parcela ainda.</p>}

      {contrato.status !== "cancelled" && (
        <form action={adicionarParcelaAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="caseId" value={contrato.case_id} />
          <input type="hidden" name="contractId" value={contrato.id} />
          <div>
            <label htmlFor={`venc-${contrato.id}`} className="block text-sm font-medium">
              Vencimento
            </label>
            <input
              id={`venc-${contrato.id}`}
              name="dataVencimento"
              type="date"
              defaultValue={hojeISO}
              required
              className="mt-1 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor={`valor-${contrato.id}`} className="block text-sm font-medium">
              Valor
            </label>
            <input
              id={`valor-${contrato.id}`}
              name="valorParcela"
              placeholder="1.250,00"
              required
              className="mt-1 w-32 rounded border border-line p-2"
            />
          </div>
          <button className="rounded border border-line px-3 py-2 text-sm">
            Adicionar parcela
          </button>
        </form>
      )}
    </div>
  );
}

export default async function ContratoPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const actor = await currentUserId();
  if (!actor) redirect("/auth/sign-in");
  const { caseId } = await params;
  if (!z.uuid().safeParse(caseId).success) notFound();

  const db = getDb();
  const profile = await db.query<{ role: string }>("SELECT role FROM profiles WHERE user_id = $1", [
    actor,
  ]);
  if (!profile[0] || !["lawyer", "admin"].includes(profile[0].role)) notFound();
  if (profile[0].role === "lawyer") {
    const acesso = await db.query<{ oab_verificado_em: Date | null }>(
      `SELECT p.oab_verificado_em FROM profiles p
       JOIN lawyer_subscriptions s ON s.lawyer_id = p.user_id
       WHERE p.user_id = $1 AND s.status IN ('active', 'trial') AND s.valid_until > now()`,
      [actor],
    );
    if (!acesso.length) redirect("/assinatura");
    if (!acesso[0].oab_verificado_em) redirect("/advogado/pendente");
  }

  // A política RLS é o filtro definitivo: um caseId de outro escritório/sem atribuição não acha nada.
  const ctx = await getCaseService().getTriageContext(caseId);
  if (!ctx) notFound();

  const { erro } = await searchParams;
  const contratos = await listarContratos(db, caseId);
  const parcelasPorContrato = await Promise.all(
    contratos.map((c) => listarParcelas(db, c.id)),
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p>
        <Link href={`/equipe/${caseId}`}>Voltar ao caso</Link>
      </p>
      <h1 className="mt-4 text-3xl">Contrato e honorários</h1>
      <p className="mt-2 text-sm text-muted">
        Sem emissão de nota fiscal ou cobrança automática nesta versão — só o registro do
        contrato e das parcelas acordadas.
      </p>

      {erro && MENSAGEM_ERRO[erro] && (
        <div className="mt-6">
          <Alert tone="error" title="Não foi possível salvar.">
            {MENSAGEM_ERRO[erro]}
          </Alert>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {contratos.map((contrato, i) => (
          <ContratoCard key={contrato.id} contrato={contrato} parcelas={parcelasPorContrato[i]} />
        ))}
      </div>
      {contratos.length === 0 && (
        <p className="mt-6 text-muted">Nenhum contrato registrado ainda.</p>
      )}

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xl">Novo contrato</h2>
        <form action={criarContratoAction} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div>
            <label htmlFor="tipoHonorario" className="block text-sm font-medium">
              Tipo de honorário
            </label>
            <select
              id="tipoHonorario"
              name="tipoHonorario"
              className="mt-1 rounded border border-line p-2"
            >
              <option value="fixed">Valor fixo</option>
              <option value="success">Honorário de êxito</option>
              <option value="hourly">Por hora</option>
              <option value="mixed">Misto (fixo + êxito)</option>
            </select>
          </div>
          <div>
            <label htmlFor="valor" className="block text-sm font-medium">
              Valor (R$)
            </label>
            <input
              id="valor"
              name="valor"
              placeholder="1.250,00"
              required
              className="mt-1 w-36 rounded border border-line p-2"
            />
          </div>
          <div>
            <label htmlFor="percentualExito" className="block text-sm font-medium">
              % de êxito (opcional)
            </label>
            <input
              id="percentualExito"
              name="percentualExito"
              placeholder="ex.: 20"
              className="mt-1 w-28 rounded border border-line p-2"
            />
          </div>
          <button className="rounded bg-navy px-4 py-2 text-white">Criar contrato</button>
        </form>
      </section>
    </main>
  );
}
