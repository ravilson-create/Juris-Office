-- Resumo de caso gerado por IA (Fase F3, primeira peça). Nunca é gerado sozinho — só quando o
-- advogado clica — e nunca substitui o dossiê nem a decisão de viabilidade: é leitura de apoio.
-- Uma linha por caso (decidir gerar de novo substitui a anterior, igual a case_viability).
CREATE TABLE case_ai_summaries (
  case_id uuid PRIMARY KEY REFERENCES legal_cases(id) ON DELETE CASCADE,
  sintese text NOT NULL,
  pedido_principal text NOT NULL,
  pontos_chave jsonb NOT NULL,
  documentos_faltantes jsonb NOT NULL,
  riscos_aparentes jsonb NOT NULL,
  modelo text NOT NULL,
  gerado_por text NOT NULL REFERENCES profiles(user_id),
  gerado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE case_ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_summary_read ON case_ai_summaries FOR SELECT USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);
CREATE POLICY ai_summary_write ON case_ai_summaries FOR ALL USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
) WITH CHECK (
  gerado_por = app_actor_id() AND actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE ON case_ai_summaries TO juris_app;
  END IF;
END $$;
