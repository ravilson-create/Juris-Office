-- Restaura o atendimento anônimo por cima da RLS da P2: entrar na conta é uma decisão de
-- produto sempre opcional para o cidadão — nunca um requisito. A 0003 fez toda política de
-- legal_cases/triage_answers/case_documents/dossiers/case_drafts/case_draft_commits depender só
-- de app.user_id (preenchido pela Neon Auth), o que bloqueava quem não está logado assim que a
-- autenticação é configurada no ambiente. Agora a sessão também carrega app.anon_hash — o hash
-- da sessão anônima do navegador, independente de login — e as políticas de dono aceitam
-- qualquer um dos dois canais.
CREATE FUNCTION app_anon_hash() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.anon_hash', true), '')
$$;

CREATE OR REPLACE FUNCTION owns_case(target uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM legal_cases WHERE id = target AND (
      (app_actor_id() IS NOT NULL AND citizen_id = app_actor_id())
      OR (app_anon_hash() IS NOT NULL AND owner_session_hash = app_anon_hash())
    )
  )
$$;

CREATE OR REPLACE FUNCTION can_read_case(target uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT owns_case(target) OR (
    app_actor_id() IS NOT NULL AND EXISTS (
      SELECT 1 FROM legal_cases c WHERE c.id = target AND (
        EXISTS (
          SELECT 1 FROM case_assignments a JOIN profiles p ON p.user_id = app_actor_id()
          WHERE a.case_id = c.id AND a.office_id = p.office_id AND (
            (p.role = 'lawyer' AND a.lawyer_id = p.user_id AND has_active_subscription(p.user_id))
            OR p.role = 'admin'
          )
        ) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = app_actor_id()
          AND p.role = 'admin' AND p.office_id = c.office_id)
      )
    )
  )
$$;

-- citizen_case_insert/update checam a linha diretamente (não via owns_case), por isso precisam
-- ser recriadas: aceitam ownerSessionHash quando não há login, citizenId quando há.
DROP POLICY citizen_case_insert ON legal_cases;
CREATE POLICY citizen_case_insert ON legal_cases FOR INSERT WITH CHECK (
  (app_actor_id() IS NOT NULL AND citizen_id = app_actor_id())
  OR (app_actor_id() IS NULL AND app_anon_hash() IS NOT NULL AND owner_session_hash = app_anon_hash())
);
DROP POLICY citizen_case_update ON legal_cases;
CREATE POLICY citizen_case_update ON legal_cases FOR UPDATE USING (owns_case(id)) WITH CHECK (
  (app_actor_id() IS NOT NULL AND citizen_id = app_actor_id())
  OR (app_actor_id() IS NULL AND app_anon_hash() IS NOT NULL AND owner_session_hash = app_anon_hash())
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION app_anon_hash() TO juris_app;
  END IF;
END $$;
