import { z } from "zod";

export const auxilioCampoPecaSchema = z.object({
  textoAuxiliado: z.string().min(1),
});
export type AuxilioCampoPeca = z.infer<typeof auxilioCampoPecaSchema>;
