import { z } from "zod";

/** Documento anexado ao caso (Sprint 2 — upload simulado: só metadados). */
export const caseDocumentSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  category: z.string().min(1),
  originalName: z.string().min(1),
  storagePath: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  status: z.enum(["pending", "uploaded", "rejected"]),
  createdAt: z.iso.datetime(),
});
export type CaseDocument = z.infer<typeof caseDocumentSchema>;

/** Item do checklist de documentos de uma área (configurável por dados). */
export const documentChecklistItemSchema = z.object({
  id: z.uuid(),
  legalAreaId: z.uuid(),
  category: z.string().regex(/^[a-z][a-z0-9_]*$/, "categoria deve ser snake_case"),
  label: z.string().min(1),
  description: z.string().min(1),
  recommended: z.boolean(),
  sortOrder: z.number().int(),
});
export type DocumentChecklistItem = z.infer<typeof documentChecklistItemSchema>;

/** Categoria sempre disponível para documentos que não se encaixam no checklist. */
export const OTHER_DOCUMENTS_CATEGORY = "outros";
export const OTHER_DOCUMENTS_LABEL = "Outros documentos";
