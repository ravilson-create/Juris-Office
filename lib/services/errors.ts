export type ServiceResult<T> =
  { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_found"
      | "area_unavailable"
      | "not_editable"
      | "step_out_of_range"
      | "identification_pending"
      | "triage_pending"
      | "narrative_pending"
      | "document_limit"
      | "review_pending"
      | "revision_conflict",
  ) {
    super(message);
    this.name = "DomainError";
  }
}
