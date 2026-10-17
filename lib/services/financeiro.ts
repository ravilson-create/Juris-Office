import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { businessDate } from "@/domain/time";
import type { Db } from "@/lib/db/types";
import {
  civilDate,
  entrySchema,
  splitInstallments,
  type NewFinancialEntry,
} from "@/domain/financeiro/schema";

export const financeFilters = z
  .object({
    from: civilDate.optional(),
    to: civilDate.optional(),
    direction: z.enum(["receber", "pagar"]).optional(),
    kind: z.enum(["honorarios", "receita", "despesa", "repasse", "acerto"]).optional(),
    status: z.enum(["aberto", "quitado", "vencido", "cancelado"]).optional(),
    caseId: z.uuid().optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: "Período inválido." });
export type FinanceFilters = z.infer<typeof financeFilters>;
export type FinancialRow = {
  id: string;
  description: string;
  counterparty: string;
  kind: NewFinancialEntry["kind"];
  direction: "receber" | "pagar";
  amount_cents: string;
  due_date: string;
  paid_cents: string;
  balance_cents: string;
  status: "aberto" | "quitado" | "vencido" | "cancelado";
  installment_number: number;
  installment_count: number;
  case_id: string | null;
  protocol: string | null;
  created_by: string;
  notes: string;
};

export async function financialHistory(db: Db, ids: string[]) {
  return db.query<{
    id: string;
    entry_id: string;
    amount_cents: string;
    paid_on: string;
    note: string;
  }>(
    `SELECT id,entry_id,amount_cents::text,paid_on::text,note FROM financial_settlements
     WHERE entry_id=ANY($1::uuid[]) ORDER BY paid_on,created_at,id`,
    [ids],
  );
}

export async function createFinancialEntry(
  db: Db,
  actor: string,
  office: string,
  input: NewFinancialEntry,
) {
  const v = entrySchema.parse(input);
  return db.transaction(async (tx) => {
    for (const p of splitInstallments(v.amountCents, v.installments, v.dueDate)) {
      await tx.query(
        `INSERT INTO financial_entries(id, office_id, created_by, request_id,
        installment_number, installment_count, case_id, description, counterparty, kind,
        direction, amount_cents, due_date, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (office_id, created_by, request_id, installment_number) DO NOTHING`,
        [
          randomUUID(),
          office,
          actor,
          v.requestId,
          p.number,
          v.installments,
          v.caseId,
          v.description,
          v.counterparty,
          v.kind,
          v.direction,
          p.amountCents,
          p.dueDate,
          v.notes,
        ],
      );
    }
  });
}

export async function settleFinancialEntry(
  db: Db,
  actor: string,
  input: {
    id: string;
    entryId: string;
    amountCents: number;
    paidOn: string;
    note: string;
  },
) {
  const v = z
    .object({
      id: z.uuid(),
      entryId: z.uuid(),
      amountCents: z.number().int().min(1).max(100_000_000_000),
      paidOn: civilDate,
      note: z.string().trim().max(1000),
    })
    .parse(input);
  if (v.paidOn > businessDate(new Date())) throw new Error("A baixa não pode ter data futura.");
  await db.transaction(async (tx) => {
    // Mesmo lock do trigger; reenvios depois de uma baixa total são idempotentes.
    const entry = await tx.query(
      "SELECT id FROM financial_entries WHERE id=$1 AND NOT cancelled FOR UPDATE",
      [v.entryId],
    );
    if (!entry.length) throw new Error("Registro indisponível.");
    const existing = await tx.query("SELECT id FROM financial_settlements WHERE id=$1", [v.id]);
    if (existing.length) return;
    await tx.query(
      `INSERT INTO financial_settlements(id, entry_id, created_by, amount_cents, paid_on, note)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [v.id, v.entryId, actor, v.amountCents, v.paidOn, v.note],
    );
  });
}

export async function cancelFinancialEntry(db: Db, id: string) {
  z.uuid().parse(id);
  const rows = await db.query(
    "UPDATE financial_entries SET cancelled=true WHERE id=$1 AND NOT cancelled RETURNING id",
    [id],
  );
  if (!rows.length) throw new Error("Registro indisponível.");
}

/** Importação expressa de uma parcela pendente, uma única vez. Não altera o contrato. */
export async function importContractInstallment(db: Db, actor: string, office: string, id: string) {
  z.uuid().parse(id);
  await db.transaction(async (tx) => {
    const existing = await tx.query(
      "SELECT id FROM financial_entries WHERE source_installment_id=$1",
      [id],
    );
    if (existing.length) return;
    const rows = await tx.query(
      `INSERT INTO financial_entries(id,office_id,created_by,request_id,
      installment_number,installment_count,case_id,source_installment_id,description,counterparty,
      kind,direction,amount_cents,due_date)
      SELECT $1,$2,$3,$1,1,1,c.case_id,i.id,'Honorários · ' || lc.protocol,
      coalesce(nullif(lc.applicant->>'name',''),'Cliente do atendimento'),
      'honorarios','receber',i.amount_cents,i.due_date
      FROM contract_installments i JOIN contracts c ON c.id=i.contract_id
      JOIN legal_cases lc ON lc.id=c.case_id
      WHERE i.id=$4 AND i.status <> 'paid' AND c.status <> 'cancelled' AND lc.office_id=$2
      ON CONFLICT (source_installment_id) DO NOTHING RETURNING id`,
      [randomUUID(), office, actor, id],
    );
    if (!rows.length) throw new Error("Parcela indisponível ou já registrada.");
  });
}

const base = `SELECT e.id,e.description,e.counterparty,e.kind,e.direction,e.amount_cents,
  e.installment_number,e.installment_count,e.case_id,e.created_by,e.notes,e.due_date::text AS due_date, lc.protocol,
  coalesce(s.paid,0)::text AS paid_cents, (e.amount_cents-coalesce(s.paid,0))::text AS balance_cents,
  CASE WHEN e.cancelled THEN 'cancelado' WHEN coalesce(s.paid,0)=e.amount_cents THEN 'quitado'
    WHEN e.due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'vencido' ELSE 'aberto' END AS status
  FROM financial_entries e LEFT JOIN legal_cases lc ON lc.id=e.case_id
  LEFT JOIN (SELECT entry_id,sum(amount_cents) AS paid FROM financial_settlements GROUP BY entry_id) s ON s.entry_id=e.id`;

function where(v: FinanceFilters) {
  return {
    sql: `($1::date IS NULL OR due_date::date >= $1) AND ($2::date IS NULL OR due_date::date <= $2)
    AND ($3::text IS NULL OR direction=$3) AND ($4::text IS NULL OR kind=$4)
    AND ($5::text IS NULL OR status=$5) AND ($6::uuid IS NULL OR case_id=$6)`,
    values: [
      v.from ?? null,
      v.to ?? null,
      v.direction ?? null,
      v.kind ?? null,
      v.status ?? null,
      v.caseId ?? null,
    ],
  };
}

export async function listFinancialEntries(db: Db, filters: FinanceFilters, page = 1, limit = 30) {
  const v = where(financeFilters.parse(filters));
  return db.query<FinancialRow>(
    `SELECT * FROM (${base}) q WHERE ${v.sql}
    ORDER BY due_date,id LIMIT $7 OFFSET $8`,
    [...v.values, limit, (page - 1) * limit],
  );
}

export async function financialSummary(db: Db, filters: FinanceFilters) {
  const v = where(financeFilters.parse(filters));
  const [summary] = await db.query<{
    receivable: string;
    payable: string;
    overdue: string;
    count: string;
  }>(
    `SELECT coalesce(sum(balance_cents::bigint) FILTER (WHERE direction='receber' AND status <> 'cancelado'),0)::text AS receivable,
     coalesce(sum(balance_cents::bigint) FILTER (WHERE direction='pagar' AND status <> 'cancelado'),0)::text AS payable,
     coalesce(sum(balance_cents::bigint) FILTER (WHERE direction='receber' AND status='vencido'),0)::text AS overdue,
     count(*)::text AS count FROM (${base}) q WHERE ${v.sql}`,
    v.values,
  );
  return summary;
}

/** Caixa por data efetiva de baixa; previsão por vencimento, sem contar promessa como dinheiro. */
export async function financialCashFlow(db: Db, from: string, to: string) {
  civilDate.parse(from);
  civilDate.parse(to);
  return db.query<{
    month: string;
    received: string;
    paid: string;
    expected_in: string;
    expected_out: string;
  }>(
    `WITH actual AS (
      SELECT to_char(s.paid_on,'YYYY-MM') AS month,
      sum(s.amount_cents) FILTER (WHERE e.direction='receber') AS received,
      sum(s.amount_cents) FILTER (WHERE e.direction='pagar') AS paid
      FROM financial_settlements s JOIN financial_entries e ON e.id=s.entry_id
      WHERE s.paid_on BETWEEN $1::date AND $2::date GROUP BY 1
    ), expected AS (
      SELECT to_char(due_date::date,'YYYY-MM') AS month,
      sum(balance_cents::bigint) FILTER (WHERE direction='receber') AS expected_in,
      sum(balance_cents::bigint) FILTER (WHERE direction='pagar') AS expected_out
      FROM (${base}) q WHERE status <> 'cancelado' AND due_date::date BETWEEN $1::date AND $2::date GROUP BY 1
    ) SELECT coalesce(a.month,e.month) AS month, coalesce(received,0)::text AS received,
      coalesce(paid,0)::text AS paid, coalesce(expected_in,0)::text AS expected_in,
      coalesce(expected_out,0)::text AS expected_out FROM actual a FULL JOIN expected e ON e.month=a.month ORDER BY 1`,
    [from, to],
  );
}

export async function financialOptions(db: Db) {
  const [cases, installments] = await Promise.all([
    db.query<{
      id: string;
      protocol: string;
      name: string;
    }>(`SELECT id,protocol,coalesce(applicant->>'name',title,protocol) AS name
      FROM legal_cases WHERE office_id=actor_office_id() ORDER BY updated_at DESC LIMIT 500`),
    db.query<{
      id: string;
      protocol: string;
      amount_cents: string;
      due_date: string;
    }>(`SELECT i.id,lc.protocol,i.amount_cents::text,i.due_date::text
      FROM contract_installments i JOIN contracts c ON c.id=i.contract_id JOIN legal_cases lc ON lc.id=c.case_id
      WHERE i.status <> 'paid' AND c.status <> 'cancelled' AND lc.office_id=actor_office_id()
      AND NOT EXISTS (SELECT 1 FROM financial_entries e WHERE e.source_installment_id=i.id)
      ORDER BY i.due_date LIMIT 200`),
  ]);
  return { cases, installments };
}
