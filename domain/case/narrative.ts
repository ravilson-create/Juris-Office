import { z } from "zod";

export const NARRATIVE_MIN = 30;
export const NARRATIVE_MAX = 8000;

/** Orientação neutra exibida acima do campo (não induz a resposta). */
export const NARRATIVE_GUIDANCE =
  "Conte o que aconteceu, indicando, se souber, quem participou, quando ocorreu, valores envolvidos, providências já tomadas e o que você precisa resolver.";

export const narrativeSchema = z.object({
  narrative: z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(
      z
        .string()
        .min(NARRATIVE_MIN, {
          error: `Conte com um pouco mais de detalhes (mínimo de ${NARRATIVE_MIN} caracteres).`,
        })
        .max(NARRATIVE_MAX, { error: `Use no máximo ${NARRATIVE_MAX} caracteres.` }),
    ),
});
export type NarrativeInput = z.input<typeof narrativeSchema>;
