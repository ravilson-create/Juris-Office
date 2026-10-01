-- Prazos e alertas (Portal do Advogado, PR3 — ativa o módulo F6, antes só tipos em
-- domain/deadline/schema.ts). assigned_to é texto (igual profiles.user_id), não uuid: o schema
-- do domínio tinha z.uuid() ali, mas os IDs de ator nesta base são texto (ver app_actor_id()).
CREATE TABLE deadlines (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  type text NOT NULL CHECK (length(trim(type)) BETWEEN 1 AND 160),
  counting_rule text NOT NULL CHECK (counting_rule IN ('business_days', 'calendar_days')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'missed')),
  assigned_to text NOT NULL REFERENCES profiles(user_id),
  escalated_at timestamptz,
  created_by text NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);
CREATE INDEX deadlines_case_idx ON deadlines(case_id, due_date);
CREATE INDEX deadlines_abertos_idx ON deadlines(due_date) WHERE status = 'open';

ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de case_notes: só advogado/admin com acesso ao caso. O job de escalonamento
-- (cron) roda com a conexão de manutenção, que é dona das tabelas e não passa pela RLS — por
-- isso não precisa de política própria para marcar 'missed'.
CREATE POLICY deadlines_read ON deadlines FOR SELECT USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);
CREATE POLICY deadlines_insert ON deadlines FOR INSERT WITH CHECK (
  created_by = app_actor_id() AND actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);
-- Só o próprio responsável ou um admin do caso conclui o prazo — nunca outro advogado do
-- escritório que só por acaso também tem acesso ao caso.
CREATE POLICY deadlines_update ON deadlines FOR UPDATE USING (
  can_read_case(case_id) AND (assigned_to = app_actor_id() OR actor_role() = 'admin')
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE ON deadlines TO juris_app;
  END IF;
END $$;
