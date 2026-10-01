import type { LegalCase } from "@/domain/case/schema";
import { PG_UNIQUE_VIOLATION, pgErrorCode, type Db, type Queryable } from "@/lib/db/types";
import {
  NotFoundError,
  ProtocolConflictError,
  type CaseRepository,
  type CreateCaseInput,
  type FinalizeSubmissionInput,
  type FinalizeSubmissionResult,
  type UpdateCaseInput,
} from "../types";
import { CASE_COLUMNS, toCase } from "./mappers";

/** Campos atualizáveis → colunas. `applicant` é jsonb. */
const UPDATABLE: Record<keyof UpdateCaseInput, string> = {
  status: "status",
  applicant: "applicant",
  consentAccepted: "consent_accepted",
  consentAcceptedAt: "consent_accepted_at",
  narrative: "narrative",
  title: "title",
  submittedAt: "submitted_at",
};

export class PgCaseRepository implements CaseRepository {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(input: CreateCaseInput): Promise<LegalCase> {
    const ts = this.now().toISOString();
    try {
      const rows = await this.db.query(
        `INSERT INTO legal_cases (id, protocol, legal_area_id, owner_session_hash, citizen_id, status,
           consent_accepted, revision, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'draft', false, 0, $6, $6)
         RETURNING ${CASE_COLUMNS}`,
        [
          crypto.randomUUID(),
          input.protocol,
          input.legalAreaId,
          input.ownerSessionHash ?? null,
          input.citizenId ?? null,
          ts,
        ],
      );
      return toCase(rows[0]);
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION)
        throw new ProtocolConflictError(input.protocol);
      throw error;
    }
  }

  async findById(id: string): Promise<LegalCase | null> {
    const rows = await this.db.query(`SELECT ${CASE_COLUMNS} FROM legal_cases WHERE id = $1`, [id]);
    return rows[0] ? toCase(rows[0]) : null;
  }

  async listByOwner(ownerSessionHash: string): Promise<LegalCase[]> {
    // `ownerSessionHash` aqui é o identificador de quem pede — conta logada ou sessão anônima
    // do navegador — e pode bater com qualquer uma das duas colunas, dependendo de como aquele
    // atendimento específico foi criado (login é sempre opcional, nunca obrigatório).
    const rows = await this.db.query(
      `SELECT ${CASE_COLUMNS} FROM legal_cases
       WHERE owner_session_hash = $1 OR citizen_id = $1
       ORDER BY updated_at DESC`,
      [ownerSessionHash],
    );
    return rows.map(toCase);
  }

  async update(id: string, input: UpdateCaseInput): Promise<LegalCase> {
    const sets: string[] = [];
    const params: unknown[] = [id, this.now().toISOString()];
    for (const key of Object.keys(UPDATABLE) as Array<keyof UpdateCaseInput>) {
      const value = input[key];
      if (value === undefined) continue;
      params.push(key === "applicant" ? JSON.stringify(value) : value);
      sets.push(`${UPDATABLE[key]} = $${params.length}${key === "applicant" ? "::jsonb" : ""}`);
    }
    // Toda alteração de conteúdo incrementa a revisão (controle otimista da finalização).
    const rows = await this.db.query(
      `UPDATE legal_cases SET ${[...sets, "revision = revision + 1", "updated_at = $2"].join(", ")}
       WHERE id = $1 RETURNING ${CASE_COLUMNS}`,
      params,
    );
    if (!rows[0]) throw new NotFoundError("Caso", id);
    return toCase(rows[0]);
  }

  /**
   * Grava o dossiê e finaliza o caso na MESMA transação, com a linha do caso bloqueada
   * (FOR UPDATE): chamadas simultâneas se enfileiram, e a restrição UNIQUE (case_id, version)
   * impede dois dossiês com a mesma versão mesmo que o bloqueio falhe.
   */
  async finalizeSubmission(input: FinalizeSubmissionInput): Promise<FinalizeSubmissionResult> {
    return this.db.transaction(async (tx: Queryable) => {
      const found = await tx.query(
        `SELECT ${CASE_COLUMNS} FROM legal_cases WHERE id = $1 FOR UPDATE`,
        [input.caseId],
      );
      if (!found[0]) return { ok: false, reason: "not_found" } as const;
      const current = toCase(found[0]);
      if (current.submittedAt) return { ok: false, reason: "already_submitted" } as const;
      if (current.revision !== input.expectedRevision) {
        return { ok: false, reason: "revision_conflict" } as const;
      }
      const inserted = await tx.query(
        `INSERT INTO dossiers (id, case_id, version, payload, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (case_id, version) DO NOTHING RETURNING id`,
        [
          input.dossier.id,
          input.caseId,
          input.dossier.version,
          JSON.stringify(input.dossier),
          input.dossier.createdAt,
        ],
      );
      if (!inserted[0]) return { ok: false, reason: "already_submitted" } as const;
      const updated = await tx.query(
        `UPDATE legal_cases SET status = 'submitted', submitted_at = $2, revision = revision + 1,
           updated_at = $2 WHERE id = $1 RETURNING ${CASE_COLUMNS}`,
        [input.caseId, input.submittedAt],
      );
      return { ok: true, legalCase: toCase(updated[0]), dossier: input.dossier } as const;
    });
  }
}
