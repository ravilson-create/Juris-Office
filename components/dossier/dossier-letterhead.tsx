import { formatInstantDate } from "@/domain/time";
import { BrandSymbol, BrandSymbolMono, BrandWordmark } from "@/components/brand/brand-logo";

/**
 * Cabeçalho timbrado do dossiê jurídico preliminar.
 * Na tela usa o símbolo colorido; na impressão, a versão monocromática (economiza tinta
 * e mantém legibilidade em impressoras P&B).
 */
export function DossierLetterhead({
  title,
  protocol,
  areaName,
  date,
  statusLabel,
  version,
}: {
  title: string;
  protocol: string;
  areaName: string;
  /** Instante ISO 8601 (UTC); exibido no fuso de negócio. */
  date: string;
  statusLabel: string;
  version?: number;
}) {
  const formatted = formatInstantDate(date);
  return (
    <header className="flex flex-col gap-5 border-b-2 border-navy pb-5 print:border-black">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="inline-flex items-center gap-3 whitespace-nowrap text-ink">
          <BrandSymbol height={48} priority className="print:hidden" />
          <BrandSymbolMono height={48} className="hidden print:inline-block" />
          <span className="print:text-black">
            <BrandWordmark size="md" />
          </span>
        </span>
        <p className="text-sm text-muted sm:text-right">
          Protocolo
          <span className="block whitespace-nowrap font-semibold tabular-nums text-ink">
            {protocol}
          </span>
        </p>
      </div>
      <div>
        <p className="text-xl font-bold text-navy print:text-black">{title}</p>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted">Área:</dt>
            <dd className="font-medium">{areaName}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Data:</dt>
            <dd className="font-medium tabular-nums">{formatted}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">Situação:</dt>
            <dd className="font-medium">{statusLabel}</dd>
          </div>
          {version !== undefined && (
            <div className="flex gap-1.5">
              <dt className="text-muted">Versão:</dt>
              <dd className="font-medium tabular-nums">{version}</dd>
            </div>
          )}
        </dl>
      </div>
    </header>
  );
}
