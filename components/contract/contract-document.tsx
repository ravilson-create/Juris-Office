import type { ContractContent, FeeType } from "@/domain/contract/schema";
import { gerarClausulasContrato } from "@/lib/contracts/clausulas";
import { formatInstantDateTime } from "@/domain/time";

type AssinaturaStatus = { signedAt: string } | null;

/**
 * Documento do contrato: cláusulas completas (lib/contracts/clausulas.ts) + status de assinatura
 * de cada parte. Usado tanto na área profissional quanto na página do cliente — o mesmo texto
 * para os dois lados é o ponto do contrato.
 */
export function ContractDocument({
  content,
  feeType,
  feeValueCents,
  successPercentage,
  lawyerSignature,
  clientSignature,
}: {
  content: ContractContent;
  feeType: FeeType;
  feeValueCents: number;
  successPercentage: number | null;
  lawyerSignature: AssinaturaStatus;
  clientSignature: AssinaturaStatus;
}) {
  const clausulas = gerarClausulasContrato({ content, feeType, feeValueCents, successPercentage });
  return (
    <article
      aria-label="Contrato de prestação de serviços advocatícios"
      className="rounded-md border border-line bg-surface p-5 sm:p-8 print:rounded-none print:border-0 print:p-0"
    >
      <h2 className="text-center text-lg font-bold uppercase tracking-wide">
        Contrato de Prestação de Serviços Advocatícios
      </h2>

      <div className="mt-6 flex flex-col gap-5">
        {clausulas.map((c) => (
          <section key={c.chave} aria-labelledby={`clausula-${c.chave}`}>
            <h3 id={`clausula-${c.chave}`} className="font-sans font-semibold">
              {c.titulo}
            </h3>
            <p className="mt-1 whitespace-pre-line leading-relaxed">{c.corpo}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
        <AssinaturaBloco
          titulo="CONTRATADO"
          nome={content.lawyerFullName}
          assinatura={lawyerSignature}
        />
        <AssinaturaBloco
          titulo="CONTRATANTE"
          nome={content.clientFullName}
          assinatura={clientSignature}
        />
      </div>
    </article>
  );
}

function AssinaturaBloco({
  titulo,
  nome,
  assinatura,
}: {
  titulo: string;
  nome: string;
  assinatura: AssinaturaStatus;
}) {
  return (
    <div className="rounded-md border border-line p-4 text-sm">
      <p className="font-semibold">{titulo}</p>
      <p className="mt-1">{nome}</p>
      {assinatura ? (
        <p className="mt-3 text-muted">
          Assinado eletronicamente em {formatInstantDateTime(assinatura.signedAt)}.
        </p>
      ) : (
        <p className="mt-3 text-muted">Assinatura pendente.</p>
      )}
    </div>
  );
}
