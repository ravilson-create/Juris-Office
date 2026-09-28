import { z } from "zod";

/** Módulo 6 — Acompanhamento processual e alertas (Fase F6). Somente tipos nesta fase. */
export const processEventSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  date: z.iso.date(),
  type: z.string().min(1),
  description: z.string().min(1),
  source: z.enum(["manual", "integration"]),
});
export type ProcessEvent = z.infer<typeof processEventSchema>;

export const deadlineSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  dueDate: z.iso.date(),
  type: z.string().min(1),
  countingRule: z.enum(["business_days", "calendar_days"]),
  status: z.enum(["open", "done", "missed"]),
  assignedTo: z.uuid(),
  escalatedAt: z.iso.datetime().optional(),
});
export type Deadline = z.infer<typeof deadlineSchema>;
