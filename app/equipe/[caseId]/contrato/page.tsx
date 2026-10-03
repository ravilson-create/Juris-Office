import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { PrintButton } from "@/components/dossier/print-button";
import { ContractDocument } from "@/components/contract/contract-document";
import { temClausulasCompletas } from "@/lib/contracts/clausulas";
import { currentUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/connection";
import { getCaseService } from "@/lib/services";
import { BRAZIL_UFS } from "@/domain/case/schema";
import { formatCents } from "@/domain/triage/money";
import {
  adicionarParcelaAction,
  assinarEEnviarContratoAction,
  criarContratoAction,
  excluirContratoAction,
  marcarParcelaPagaAction,
  mudarStatusContratoAction,
} from "../../actions";
import {
  listarAssinaturasPorContrato,
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
  contrato_qualificacao:
    "Preencha corretamente a qualificação completa: nome e CPF do advogado, endereços, objeto e foro. É preciso ter OAB confirmada e escritório cadastrado.",
  contrato_confirmacao: "Confirme que revisou a minuta para assinar e enviar ao cliente.",
  contrato_assinatura_necessaria: "Enviar o contrato exige a assinatura do advogado responsável.",
  limite: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
  parcela_dados: "Preencha a data e o valor da parcela corretamente.",
  contrato_nao_excluivel: "Só é possível excluir um contrato em rascunho ou cancelado.",
};

function ContratoCard({
  contrato,
  parcelas,
  lawyerSignedAt,
  clientSignedAt,
}: {
  contrato: ContratoRow;
  parcelas: ParcelaRow[];
  lawyerSignedAt: string | null;
  clientSignedAt: string | null;
}) {
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

      {temClausulasCompletas(contrato.content) ? (
        <div className="mt-3">
          <ContractDocument
            content={contrato.content}
            feeType={contrato.fee_type}
            feeValueCents={Number(contrato.fee_value_cents)}
            successPercentage={contrato.success_percentage ? Number(contrato.success_percentage) : null}
            lawyerSignature={lawyerSignedAt ? { signedAt: lawyerSignedAt } : null}
            clientSignature={clientSignedAt ? { signedAt: clientSignedAt } : null}
          />
          {contrato.status !== "draft" && (
            <div className="mt-3 print:hidden">
              <PrintButton>Imprimir ou salvar o contrato em PDF</PrintButton>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Este contrato foi criado antes das cláusulas completas existirem nesta versão — sem
          qualificação das partes para gerar o texto. Cancele e crie um novo para ter o contrato
          completo.
        </p>
      )}

      {contrato.status === "draft" && (
        <form action={assinarEEnviarContratoAction} className="mt-3 rounded border border-line p-3">
          <input type="hidden" name="caseId" value={contrato.case_id} />
          <input type="hidden" name="contractId" value={contrato.id} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirmaAssinatura" required className="mt-0.5" />
            Revisei a minuta acima e assino este contrato como responsável pelo CONTRATADO.
          </label>
          <button className="mt-3 rounded bg-navy px-3 py-2 text-sm text-white">
            Assinar e enviar ao cliente
          </button>
        </form>
      )}

      {contrato.status !== "cancelled" && contrato.status !== "signed" && (
        <form action={mudarStatusContratoAction} className="mt-3 flex gap-2">
          <input type="hidden" name="caseId" value={contrato.case_id} />
          <input type="hidden" name="contractId" value={contrato.id} />
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
  const parcelasPorContrato = await Promise.all(contratos.map((c) => listarParcelas(db, c.id)));
  const assinaturasPorContrato = await Promise.all(
    contratos.map((c) => listarAssinaturasPorContrato(db, c.id)),
  );
  const objetoSugerido = `${ctx.area.name}${ctx.legalCase.title ? ` — ${ctx.legalCase.title}` : ""}, conforme relato e documentos do atendimento protocolo ${ctx.legalCase.protocol}.`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p>
        <Link href={`/equipe/${caseId}`}>Voltar ao caso</Link>
      </p>
      <h1 className="mt-4 text-3xl">Contrato e honorários</h1>
      <p className="mt-2 text-sm text-muted">
        Sem emissão de nota fiscal ou cobrança automática nesta versão — só o registro do
        contrato, das cláusulas e das parcelas acordadas.
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
          <ContratoCard
            key={contrato.id}
            contrato={contrato}
            parcelas={parcelasPorContrato[i]!}
            lawyerSignedAt={
              assinaturasPorContrato[i]!.find((a) => a.signer_role === "lawyer")?.signed_at ?? null
            }
            clientSignedAt={
              assinaturasPorContrato[i]!.find((a) => a.signer_role === "client")?.signed_at ?? null
            }
          />
        ))}
      </div>
      {contratos.length === 0 && (
        <p className="mt-6 text-muted">Nenhum contrato registrado ainda.</p>
      )}

      <section className="mt-8 border-t border-line pt-6">
        <h2 className="text-xl">Novo contrato</h2>
        <p className="mt-1 text-sm text-muted">
          OAB, escritório e dados do cliente são preenchidos automaticamente a partir do cadastro
          e do atendimento — só o que nenhum dos dois guarda hoje é pedido abaixo.
        </p>
        <form action={criarContratoAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="caseId" value={caseId} />

          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="advogadoNome" className="block text-sm font-medium">
                Nome completo do advogado responsável
              </label>
              <input
                id="advogadoNome"
                name="advogadoNome"
                required
                className="mt-1 w-64 rounded border border-line p-2"
              />
            </div>
            <div>
              <label htmlFor="advogadoCpf" className="block text-sm font-medium">
                CPF do advogado
              </label>
              <input
                id="advogadoCpf"
                name="advogadoCpf"
                placeholder="000.000.000-00"
                required
                className="mt-1 w-44 rounded border border-line p-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="enderecoEscritorio" className="block text-sm font-medium">
              Endereço completo do escritório
            </label>
            <input
              id="enderecoEscritorio"
              name="enderecoEscritorio"
              required
              className="mt-1 w-full rounded border border-line p-2"
            />
          </div>

          <div>
            <label htmlFor="enderecoCliente" className="block text-sm font-medium">
              Endereço completo do cliente
            </label>
            <input
              id="enderecoCliente"
              name="enderecoCliente"
              required
              className="mt-1 w-full rounded border border-line p-2"
            />
          </div>

          <div>
            <label htmlFor="objetoContrato" className="block text-sm font-medium">
              Objeto do contrato
            </label>
            <textarea
              id="objetoContrato"
              name="objetoContrato"
              key={objetoSugerido}
              defaultValue={objetoSugerido}
              required
              rows={3}
              className="mt-1 w-full rounded border border-line p-2"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="foroCidade" className="block text-sm font-medium">
                Foro de eleição — cidade
              </label>
              <input
                id="foroCidade"
                name="foroCidade"
                key={ctx.legalCase.applicant?.city}
                defaultValue={ctx.legalCase.applicant?.city}
                required
                className="mt-1 w-48 rounded border border-line p-2"
              />
            </div>
            <div>
              <label htmlFor="foroUf" className="block text-sm font-medium">
                UF
              </label>
              <select
                id="foroUf"
                name="foroUf"
                defaultValue={ctx.legalCase.applicant?.uf}
                className="mt-1 rounded border border-line p-2"
              >
                {BRAZIL_UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
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
          </div>
        </form>
      </section>
    </main>
  );
}
