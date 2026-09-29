-- P2: identidade verificada pelo Neon Auth; o app define app.user_id apenas em transações
-- após validar a sessão. O papel de execução não pode ser dono do esquema nem ter BYPASSRLS.
ALTER TABLE legal_cases ALTER COLUMN citizen_id TYPE text USING citizen_id::text;
CREATE INDEX IF NOT EXISTS legal_cases_citizen_idx ON legal_cases (citizen_id, updated_at DESC);

CREATE TABLE offices (
  id uuid PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Escritório inicial. Outros escritórios podem ser criados pelo operador antes de ativar
-- novos fluxos de encaminhamento; nenhum advogado recebe acesso sem atribuição.
INSERT INTO offices(id, name) VALUES ('00000000-0000-4000-8000-000000000001', 'Júris Office');
ALTER TABLE legal_cases ADD COLUMN office_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'
  REFERENCES offices(id);
CREATE TABLE profiles (
  user_id text PRIMARY KEY, role text NOT NULL DEFAULT 'citizen'
    CHECK (role IN ('citizen','lawyer','admin')),
  office_id uuid REFERENCES offices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_has_office CHECK (role = 'citizen' OR office_id IS NOT NULL)
);
CREATE TABLE case_assignments (
  case_id uuid NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  lawyer_id text NOT NULL REFERENCES profiles(user_id),
  office_id uuid NOT NULL REFERENCES offices(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, lawyer_id)
);
CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL, case_id uuid REFERENCES legal_cases(id) ON DELETE SET NULL,
  action text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION app_actor_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')
$$;
CREATE FUNCTION actor_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT role FROM profiles WHERE user_id = app_actor_id()
$$;
CREATE FUNCTION actor_office_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT office_id FROM profiles WHERE user_id = app_actor_id()
$$;
CREATE FUNCTION can_read_case(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT app_actor_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM legal_cases c WHERE c.id = target AND (
      c.citizen_id = app_actor_id() OR EXISTS (
        SELECT 1 FROM case_assignments a JOIN profiles p ON p.user_id = app_actor_id()
        WHERE a.case_id = c.id AND a.office_id = p.office_id AND (
          (p.role = 'lawyer' AND a.lawyer_id = p.user_id) OR p.role = 'admin'
        )
      ) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = app_actor_id()
        AND p.role = 'admin' AND p.office_id = c.office_id)
    )
  )
$$;
CREATE FUNCTION owns_case(target uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT app_actor_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM legal_cases WHERE id = target AND citizen_id = app_actor_id()
  )
$$;

ALTER TABLE legal_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY citizen_case_select ON legal_cases FOR SELECT USING (can_read_case(id));
CREATE POLICY citizen_case_insert ON legal_cases FOR INSERT WITH CHECK
  (app_actor_id() IS NOT NULL AND citizen_id = app_actor_id());
CREATE POLICY citizen_case_update ON legal_cases FOR UPDATE
  USING (owns_case(id)) WITH CHECK (citizen_id = app_actor_id());
ALTER TABLE triage_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY triage_read ON triage_answers FOR SELECT USING (can_read_case(case_id));
CREATE POLICY triage_write ON triage_answers FOR ALL USING (owns_case(case_id)) WITH CHECK (owns_case(case_id));
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_read ON case_documents FOR SELECT USING (can_read_case(case_id));
CREATE POLICY documents_write ON case_documents FOR ALL USING (owns_case(case_id)) WITH CHECK (owns_case(case_id));
ALTER TABLE dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY dossiers_read ON dossiers FOR SELECT USING (can_read_case(case_id));
CREATE POLICY dossiers_write ON dossiers FOR INSERT WITH CHECK (owns_case(case_id));
ALTER TABLE case_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY drafts_owner ON case_drafts FOR ALL USING (owns_case(case_id)) WITH CHECK (owns_case(case_id));
ALTER TABLE case_draft_commits ENABLE ROW LEVEL SECURITY;
CREATE POLICY draft_commits_owner ON case_draft_commits FOR ALL USING (owns_case(case_id)) WITH CHECK (owns_case(case_id));
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_self ON profiles FOR SELECT USING (user_id = app_actor_id());
CREATE POLICY admin_office_profiles ON profiles FOR SELECT USING (
  office_id IS NOT NULL AND actor_role() = 'admin' AND actor_office_id() = office_id
);
CREATE POLICY profile_self_create ON profiles FOR INSERT WITH CHECK
  (user_id = app_actor_id() AND role = 'citizen' AND office_id IS NULL);
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignment_read ON case_assignments FOR SELECT USING (can_read_case(case_id));
CREATE POLICY assignment_admin_insert ON case_assignments FOR INSERT WITH CHECK (
  actor_role() = 'admin' AND actor_office_id() = case_assignments.office_id
  AND EXISTS (SELECT 1 FROM profiles lawyer WHERE lawyer.user_id = lawyer_id
    AND lawyer.role = 'lawyer' AND lawyer.office_id = case_assignments.office_id)
  AND EXISTS (SELECT 1 FROM legal_cases c WHERE c.id = case_id
    AND c.office_id = case_assignments.office_id AND c.status = 'submitted')
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK (actor_id = app_actor_id());

-- Migração explícita de rascunhos antigos: só a sessão legada do próprio navegador pode
-- reivindicar os casos ainda sem conta. O usuário vem da sessão autenticada, nunca do formulário.
CREATE FUNCTION claim_legacy_cases(session_hash text) RETURNS integer LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE claimed integer;
BEGIN
  IF app_actor_id() IS NULL OR session_hash !~ '^[a-f0-9]{64}$' THEN RETURN 0; END IF;
  UPDATE legal_cases SET citizen_id = app_actor_id(), updated_at = now()
  WHERE citizen_id IS NULL AND owner_session_hash = session_hash;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  INSERT INTO audit_logs(actor_id, action) SELECT app_actor_id(), 'claim_legacy_case'
  FROM generate_series(1, claimed);
  RETURN claimed;
END $$;

-- Na Neon: conceder apenas as tabelas e funções necessárias ao papel juris_app.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE ON profiles TO juris_app;
    GRANT SELECT ON offices, case_assignments TO juris_app;
    GRANT INSERT ON case_assignments TO juris_app;
    GRANT INSERT ON audit_logs TO juris_app;
    GRANT USAGE ON SEQUENCE audit_logs_id_seq TO juris_app;
    GRANT EXECUTE ON FUNCTION app_actor_id(), actor_role(), actor_office_id(), can_read_case(uuid), owns_case(uuid), claim_legacy_cases(text) TO juris_app;
  END IF;
END $$;
