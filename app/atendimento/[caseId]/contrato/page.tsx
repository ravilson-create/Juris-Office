import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { formatCents } from "@/domain/triage/money";
import { loadCaseOr404 } from "@/lib/services/load-case";
import { getDb } from "@/lib/db/connection";
import { listarContratos, listarParcelas, type ContratoRow } from "@/lib/services/equipe-contratos";
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
  limite: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.",
};

function ContratoCard({ contrato, caseId }: { contrato: ContratoRow; caseId: string }) {
  return (
    <div className="rounded-md border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{ROTULO_TIPO_HONORARIO[contrato.fee_type]}</p>
        <span className="rounded bg-navy-soft px-2 py-1 text-xs text-navy-strong">
          {contrato.status === "signed" ? "Assinado" : "Aguardando sua assinatura"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Valor: {formatCents(Number(contrato.fee_value_cents))}
        {contrato.success_percentage && ` · Êxito: ${contrato.success_percentage}%`}
      </p>

      {contrato.status === "signed" ? (
        <p className="mt-3 text-sm text-muted">
          Assinado eletronicamente em{" "}
          {contrato.signed_at &&
            new Date(contrato.signed_at).toLocaleString("pt-BR", { timeZone: "UTC" })}
          . Este registro guarda data, hora, IP e um hash de verificação — ele não pode ser
          assinado de novo.
        </p>
      ) : (
        <form action={assinarContratoAction} className="mt-4">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="contractId" value={contrato.id} />
          <p className="text-sm text-muted">
            Ao assinar, você concorda com os termos acima. A assinatura é eletrônica: fica
            registrada com data, hora e o IP de onde foi feita, sem usar um certificado digital.
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

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p>
        <Link href={`/atendimento/${caseId}/dossie`}>Voltar ao dossiê</Link>
      </p>
      <h1 className="mt-4 text-3xl">Contrato</h1>

      {erro && MENSAGEM_ERRO[erro] && (
        <div className="mt-6">
          <Alert tone="error" title="Não foi possível concluir.">
            {MENSAGEM_ERRO[erro]}
          </Alert>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {contratos.map((contrato, i) => {
          const parcelas = parcelasPorContrato[i]!;
          return (
            <div key={contrato.id}>
              <ContratoCard contrato={contrato} caseId={caseId} />
              {parcelas.length > 0 && (
                <ul className="mt-2 space-y-1 pl-5 text-sm text-muted">
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
        <p className="mt-6 text-muted">
          Nenhum contrato enviado pelo escritório ainda. Ele aparece aqui assim que for enviado
          para sua assinatura.
        </p>
      )}
    </main>
  );
}
