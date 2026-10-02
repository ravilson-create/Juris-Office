import type { LegalCase } from "@/domain/case/schema";
import type { CaseDocument } from "@/domain/document/schema";
import type { TriageAnswer } from "@/domain/triage/schema";

type Row = Record<string, unknown>;

/** timestamptz volta como Date (ou texto); as camadas superiores usam ISO 8601 em UTC. */
export const iso = (v: unknown): string => new Date(v as string | Date).toISOString();
const isoOrUndef = (v: unknown) => (v == null ? undefined : iso(v));
const orUndef = <T>(v: T | null | undefined) => (v == null ? undefined : v);

export const CASE_COLUMNS = `id, protocol, legal_area_id, owner_session_hash, citizen_id, status, title,
  applicant, narrative, consent_accepted, consent_accepted_at, revision, created_at, updated_at,
  submitted_at, archived_at`;

export function toCase(r: Row): LegalCase {
  return {
    id: r.id as string,
    protocol: r.protocol as string,
    legalAreaId: r.legal_area_id as string,
    ownerSessionHash: orUndef(r.owner_session_hash as string | null),
    citizenId: orUndef(r.citizen_id as string | null),
    status: r.status as LegalCase["status"],
    title: orUndef(r.title as string | null),
    applicant: orUndef(r.applicant as LegalCase["applicant"] | null),
    narrative: orUndef(r.narrative as string | null),
    consentAccepted: r.consent_accepted as boolean,
    consentAcceptedAt: isoOrUndef(r.consent_accepted_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    revision: Number(r.revision),
    submittedAt: isoOrUndef(r.submitted_at),
    archivedAt: isoOrUndef(r.archived_at),
  };
}

export function toAnswer(r: Row): TriageAnswer {
  return {
    id: r.id as string,
    caseId: r.case_id as string,
    questionId: r.question_id as string,
    questionKey: r.question_key as string,
    value: r.value as TriageAnswer["value"],
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export function toDocument(r: Row): CaseDocument {
  return {
    id: r.id as string,
    caseId: r.case_id as string,
    category: r.category as string,
    originalName: r.original_name as string,
    storagePath: orUndef(r.storage_path as string | null),
    mimeType: orUndef(r.mime_type as string | null),
    size: r.size == null ? undefined : Number(r.size),
    status: r.status as CaseDocument["status"],
    createdAt: iso(r.created_at),
  };
}
