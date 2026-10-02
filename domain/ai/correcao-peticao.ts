import { z } from "zod";

export const correcaoSecaoSchema = z.object({
  corpoCorrigido: z.string().min(1),
});
export type CorrecaoSecao = z.infer<typeof correcaoSecaoSchema>;
