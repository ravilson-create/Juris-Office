import { z } from "zod";

export const legalAreaSlugSchema = z.enum([
  "consumidor",
  "trabalhista",
  "familia",
  "previdenciario",
  "civel",
]);
export type LegalAreaSlug = z.infer<typeof legalAreaSlugSchema>;

export const legalAreaSchema = z.object({
  id: z.uuid(),
  slug: legalAreaSlugSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  examples: z.array(z.string()),
  active: z.boolean(),
  sortOrder: z.number().int(),
});
export type LegalArea = z.infer<typeof legalAreaSchema>;
