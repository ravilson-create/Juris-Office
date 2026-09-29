import { z } from "zod";

export const caseStatusSchema = z.enum([
  "draft",
  "triage",
  "awaiting_documents",
  "ready_for_review",
  "submitted",
  "under_legal_review",
  "needs_information",
  "accepted",
  "rejected",
  "in_negotiation",
  "active",
  "closed",
]);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

export const BRAZIL_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

/** Dados mínimos do interessado (minimização de dados — LGPD). */
export const applicantSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, { error: "Informe seu nome completo." })
    .max(120, { error: "Use no máximo 120 caracteres." })
    .refine((v) => v.split(/\s+/).length >= 2, { error: "Informe nome e sobrenome." }),
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: "Informe um e-mail válido." })),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 10 || v.length === 11, {
      error: "Informe o telefone com DDD, por exemplo (11) 91234-5678.",
    }),
  city: z
    .string()
    .trim()
    .min(2, { error: "Informe sua cidade." })
    .max(80, { error: "Use no máximo 80 caracteres." }),
  uf: z.enum(BRAZIL_UFS, { error: "Selecione o estado (UF)." }),
  consentAccepted: z.literal(true, {
    error: "É preciso confirmar a ciência sobre o uso dos dados para continuar.",
  }),
});
export type ApplicantInput = z.input<typeof applicantSchema>;
export type Applicant = z.output<typeof applicantSchema>;

export const legalCaseSchema = z.object({
  id: z.uuid(),
  protocol: z.string(),
  citizenId: z.string().min(1).optional(),
  /** Hash da sessão do navegador que criou o caso (acesso provisório até a fase F5). */
  ownerSessionHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  legalAreaId: z.uuid(),
  status: caseStatusSchema,
  title: z.string().optional(),
  applicant: applicantSchema.optional(),
  narrative: z.string().optional(),
  consentAccepted: z.boolean(),
  consentAcceptedAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /**
   * Revisão do conteúdo do caso: incrementada a cada alteração de dados, respostas ou
   * documentos. A finalização só grava se a revisão não mudou desde a leitura
   * (controle otimista de concorrência).
   */
  revision: z.number().int().nonnegative(),
  submittedAt: z.iso.datetime().optional(),
});
export type LegalCase = z.infer<typeof legalCaseSchema>;
