/**
 * Política de data e fuso do Júris Office IA.
 *
 * - **Instantes** (criação, envio, geração do dossiê) são gravados em ISO 8601 UTC
 *   (`Date.toISOString()`) e sempre exibidos no fuso de negócio abaixo.
 * - **Datas civis** (datas dos fatos, como contratação ou início do trabalho) são strings
 *   `AAAA-MM-DD` sem hora nem fuso. Nunca passam por `new Date()` para exibição: são
 *   formatadas por manipulação de texto, então não "mudam de dia".
 * - O "dia de hoje" de uma regra de negócio (data futura, data do protocolo, evento de
 *   envio na linha do tempo) é o dia civil no fuso de negócio.
 *
 * O fuso é fixo (escritório no Brasil). Atendimento multi-fuso exigiria guardar o fuso do
 * escritório por organização — ver roadmap.
 */
export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia civil (AAAA-MM-DD) em que o instante ocorreu, no fuso de negócio. */
export function businessDate(instant: Date): string {
  const p = Object.fromEntries(partsFormatter.formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Verdadeiro para uma data civil existente (rejeita 2026-02-30, 2026-13-01 etc.). */
export function isCivilDate(value: string): boolean {
  const m = CIVIL_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/** "2026-05-10" → "10/05/2026", sem conversão de fuso. */
export function formatCivilDate(value: string): string {
  const m = CIVIL_DATE.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** Instante ISO → "27/09/2026" no fuso de negócio. */
export function formatInstantDate(iso: string): string {
  return formatCivilDate(businessDate(new Date(iso)));
}

/** Instante ISO → "27 de setembro de 2026 às 22:00" no fuso de negócio. */
export function formatInstantDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "long",
    timeStyle: "short",
  });
}

/** Compara datas civis (ordem lexicográfica de AAAA-MM-DD equivale à cronológica). */
export function compareCivilDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
