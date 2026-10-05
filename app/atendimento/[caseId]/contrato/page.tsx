import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { PrintButton } from "@/components/dossier/print-button";
import { ContractDocument } from "@/components/contract/contract-document";
import { temClausulasCompletas } from "@/lib/contracts/clausulas";
import { formatCents } from "@/domain/triage/money";
import { loadCaseOr404 } from "@/lib/services/load-case";
import { getDb } from "@/lib/db/connection";
import {
  listarAssinaturasPorContrato,
  listarContratos,
  listarParcelas,
  type ContratoRow,
} from "@/lib/services/equipe-contratos";
import { assinarContratoAction } from "../../actions";

export const metadata: Metadata = { title: "Contrato" };
export const dynamic = "force-dynamic";

const ROTULO_TIPO_HONORARIO: Record<string, string> = {
  fixed: "Valor fixo",
  success: "Honorário de êxito",
  hourly: "Por hora",
  mixed: "Misto (fixo + êxito)",
};
const MENSAGEM_ERRO: Record<string, string> = {
  contrato_invalido: "Contrato não encontrado para este atendimento.",
  contrato_transicao: "Este contrato não está mais disponível para assinatura.",
  contrato_confirmacao: "Confirme a leitura dos termos e digite seu CPF para assinar.",
  contrato_cpf: "O CPF informado não confere com o cadastrado neste atendimento.",
  limite: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
};

function ContratoCard({
  contrato,
  caseId,
  lawyerSignedAt,
  clientSignedAt,
}: {
  contrato: ContratoRow;
  caseId: string;
  lawyerSignedAt: string | null;
  clientSignedAt: string | null;
}) {
  return (
    <div className="rounded-md border border-line bg-surface p-5 print:rounded-none print:border-0 print:p-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <p className="font-semibold">{ROTULO_TIPO_HONORARIO[contrato.fee_type]}</p>
        <span className="rounded bg-navy-soft px-2 py-1 text-xs text-navy-strong">
          {contrato.status === "signed" ? "Assinado" : "Aguardando sua assinatura"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted print:hidden">
        Valor: {formatCents(Number(contrato.fee_value_cents))}
        {contrato.success_percentage && ` · Êxito: ${contrato.success_percentage}%`}
      </p>

      {temClausulasCompletas(contrato.content) && (
        <div className="mt-4">
          <ContractDocument
            content={contrato.content}
            feeType={contrato.fee_type}
            feeValueCents={Number(contrato.fee_value_cents)}
            successPercentage={contrato.success_percentage ? Number(contrato.success_percentage) : null}
            lawyerSignature={lawyerSignedAt ? { signedAt: lawyerSignedAt } : null}
            clientSignature={clientSignedAt ? { signedAt: clientSignedAt } : null}
          />
        </div>
      )}

      {contrato.status === "signed" ? (
        <div className="mt-4 print:hidden">
          <PrintButton>Imprimir ou salvar o contrato em PDF</PrintButton>
        </div>
      ) : (
        <form action={assinarContratoAction} className="mt-4 print:hidden">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="contractId" value={contrato.id} />
          <label htmlFor={`cpf-${contrato.id}`} className="block text-sm font-medium">
            Confirme seu CPF para assinar
          </label>
          <input
            id={`cpf-${contrato.id}`}
            name="cpfConfirmacao"
            inputMode="numeric"
            placeholder="000.000.000-00"
            required
            className="mt-1 w-48 rounded border border-line p-2"
          />
          <label className="mt-3 flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="concordouTermos" required className="mt-0.5" />
            Li e concordo com todas as cláusulas do contrato acima.
          </label>
          <p className="mt-2 text-xs text-muted">
            A assinatura é eletrônica: fica registrada com data, hora, IP e o CPF informado, sem
            usar certificado digital.
          </p>
          <button className="mt-3 rounded bg-navy px-4 py-2 text-white">
            Assinar eletronicamente
          </button>
        </form>
      )}
    </div>
  );
}

export default async function ContratoCidadaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { caseId } = await params;
  await loadCaseOr404(caseId); // 404 se o ID for inválido ou o caso não for deste navegador/conta.
  const { erro } = await searchParams;

  const db = getDb();
  const contratos = await listarContratos(db, caseId);
  const parcelasPorContrato = await Promise.all(contratos.map((c) => listarParcelas(db, c.id)));
  const assinaturasPorContrato = await Promise.all(
    contratos.map((c) => listarAssinaturasPorContrato(db, c.id)),
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 print:max-w-none print:p-0">
      <p className="print:hidden">
        <Link href={`/atendimento/${caseId}/dossie`}>Voltar ao dossiê</Link>
      </p>
      <h1 className="mt-4 text-3xl print:hidden">Contrato</h1>

      {erro && MENSAGEM_ERRO[erro] && (
        <div className="mt-6 print:hidden">
          <Alert tone="error" title="Não foi possível concluir.">
            {MENSAGEM_ERRO[erro]}
          </Alert>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {contratos.map((contrato, i) => {
          const parcelas = parcelasPorContrato[i]!;
          const assinaturas = assinaturasPorContrato[i]!;
          const lawyerSignedAt = assinaturas.find((a) => a.signer_role === "lawyer")?.signed_at ?? null;
          const clientSignedAt = assinaturas.find((a) => a.signer_role === "client")?.signed_at ?? null;
          return (
            <div key={contrato.id}>
              <ContratoCard
                contrato={contrato}
                caseId={caseId}
                lawyerSignedAt={lawyerSignedAt}
                clientSignedAt={clientSignedAt}
              />
              {parcelas.length > 0 && (
                <ul className="mt-2 space-y-1 pl-5 text-sm text-muted print:hidden">
                  {parcelas.map((p) => (
                    <li key={p.id}>
                      {new Date(p.due_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} —{" "}
                      {formatCents(Number(p.amount_cents))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {contratos.length === 0 && (
        <p className="mt-6 text-muted print:hidden">
          Nenhum contrato enviado pelo escritório ainda. Ele aparece aqui assim que for enviado
          para sua assinatura.
        </p>
      )}
    </main>
  );
}
