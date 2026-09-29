-- Notas privadas do escritório. Cidadãos não podem ler ou alterar estas notas.
CREATE TABLE case_notes (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES profiles(user_id),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX case_notes_case_idx ON case_notes(case_id, created_at DESC);
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY professional_notes_read ON case_notes FOR SELECT USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);
CREATE POLICY professional_notes_insert ON case_notes FOR INSERT WITH CHECK (
  author_id = app_actor_id() AND actor_role() IN ('lawyer', 'admin')
  AND can_read_case(case_id)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT ON case_notes TO juris_app;
  END IF;
END $$;
