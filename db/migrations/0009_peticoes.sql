-- Petições geradas pelo motor determinístico (fase 1, sem IA): um rascunho editável por caso,
-- visível e editável só por advogado/admin com acesso ao caso — nunca pelo cidadão, mesmo sendo
-- dono do atendimento (mesma lógica de visibilidade de case_notes).
CREATE TABLE case_petitions (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  modelo_id text NOT NULL,
  titulo_modelo text NOT NULL,
  secoes jsonb NOT NULL,
  pendencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por text NOT NULL REFERENCES profiles(user_id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX case_petitions_case_idx ON case_petitions(case_id, criado_em DESC);
ALTER TABLE case_petitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY petitions_access ON case_petitions FOR ALL USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
) WITH CHECK (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON case_petitions TO juris_app;
  END IF;
END $$;
