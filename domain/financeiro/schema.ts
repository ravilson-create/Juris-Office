import { z } from "zod";

export const financialKinds = {
  honorarios: "Honorários",
  receita: "Receita",
  despesa: "Despesa",
  repasse: "Repasse",
  acerto: "Acerto",
} as const;
export const civilDate = z.iso.date();
export const entrySchema = z
  .object({
    requestId: z.uuid(),
    description: z.string().trim().min(2).max(240),
    counterparty: z.string().trim().min(2).max(160),
    kind: z.enum(["honorarios", "receita", "despesa", "repasse", "acerto"]),
    direction: z.enum(["receber", "pagar"]),
    amountCents: z.number().int().min(1).max(100_000_000_000),
    dueDate: civilDate,
    installments: z.number().int().min(1).max(120),
    caseId: z.uuid().nullable(),
    notes: z.string().trim().max(2000),
  })
  .refine((v) => v.amountCents >= v.installments, {
    message: "Valor insuficiente para as parcelas.",
  })
  .refine((v) => v.kind !== "honorarios" || v.direction === "receber", {
    message: "Honorários são contas a receber.",
  })
  .refine((v) => !["despesa", "repasse"].includes(v.kind) || v.direction === "pagar", {
    message: "Despesas e repasses são contas a pagar.",
  });
export type NewFinancialEntry = z.infer<typeof entrySchema>;

export function splitInstallments(total: number, count: number, first: string) {
  civilDate.parse(first);
  if (
    !Number.isSafeInteger(total) ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120 ||
    total < count
  )
    throw new Error("Parcelamento inválido.");
  const [year, month, day] = first.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const last = new Date(Date.UTC(year, month + index, 0));
    const date = new Date(Date.UTC(year, month - 1 + index, Math.min(day, last.getUTCDate())));
    return {
      number: index + 1,
      amountCents: Math.floor(total / count) + (index < total % count ? 1 : 0),
      dueDate: date.toISOString().slice(0, 10),
    };
  });
}

export function moneyInput(value: unknown): number {
  const text = String(value ?? "").trim();
  if (!/^\d{1,10}([,.]\d{1,2})?$/.test(text))
    throw new Error("Informe o valor sem separador de milhar, por exemplo 1250,50.");
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
