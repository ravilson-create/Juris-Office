-- Exige número e UF da OAB do advogado, e um gate manual de verificação por um admin do mesmo
-- escritório antes de liberar acesso real a casos/leads: a OAB não tem API pública de consulta
-- (cna.oab.org.br é busca manual), então o cadastro só coleta o dado — quem confirma contra o
-- site oficial é um humano. Enquanto não verificado, o advogado continua pagando/testando, mas
-- não enxerga nenhum caso. Mudar o número da OAB sempre reseta a verificação (nunca herdar
-- confirmação de um número diferente do que foi checado).
ALTER TABLE profiles
  ADD COLUMN oab_numero text,
  ADD COLUMN oab_uf text CHECK (oab_uf IS NULL OR oab_uf ~ '^[A-Z]{2}$'),
  ADD COLUMN oab_verificado_em timestamptz,
  ADD COLUMN oab_verificado_por text REFERENCES profiles(user_id);

CREATE FUNCTION set_own_oab(p_oab_numero text, p_oab_uf text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'login necessário';
  END IF;
  UPDATE profiles SET oab_numero = p_oab_numero, oab_uf = upper(p_oab_uf),
    oab_verificado_em = NULL, oab_verificado_por = NULL
  WHERE user_id = actor AND role = 'lawyer';
END $$;

CREATE FUNCTION verify_lawyer_oab(p_lawyer_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL OR actor_role() <> 'admin' THEN
    RAISE EXCEPTION 'apenas administradores do escritório podem confirmar a OAB';
  END IF;
  UPDATE profiles SET oab_verificado_em = now(), oab_verificado_por = actor
  WHERE user_id = p_lawyer_id AND role = 'lawyer' AND office_id = actor_office_id()
    AND oab_numero IS NOT NULL AND oab_uf IS NOT NULL;
  IF FOUND THEN
    INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'verify_lawyer_oab');
  END IF;
END $$;

-- A OAB confirmada entra como mais uma condição de acesso do advogado a casos/leads, ao lado da
-- assinatura ativa — nunca substitui a assinatura, as duas são exigidas juntas.
CREATE OR REPLACE FUNCTION can_read_case(target uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT owns_case(target) OR (
    app_actor_id() IS NOT NULL AND EXISTS (
      SELECT 1 FROM legal_cases c WHERE c.id = target AND (
        EXISTS (
          SELECT 1 FROM case_assignments a JOIN profiles p ON p.user_id = app_actor_id()
          WHERE a.case_id = c.id AND a.office_id = p.office_id AND (
            (p.role = 'lawyer' AND a.lawyer_id = p.user_id AND has_active_subscription(p.user_id)
              AND p.oab_verificado_em IS NOT NULL)
            OR p.role = 'admin'
          )
        ) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = app_actor_id()
          AND p.role = 'admin' AND p.office_id = c.office_id)
      )
    )
  )
$$;

DROP POLICY assignment_admin_insert ON case_assignments;
CREATE POLICY assignment_admin_insert ON case_assignments FOR INSERT WITH CHECK (
  actor_role() = 'admin' AND actor_office_id() = case_assignments.office_id
  AND EXISTS (SELECT 1 FROM profiles lawyer WHERE lawyer.user_id = lawyer_id
    AND lawyer.role = 'lawyer' AND lawyer.office_id = case_assignments.office_id
    AND lawyer.oab_verificado_em IS NOT NULL)
  AND has_active_subscription(lawyer_id)
  AND EXISTS (SELECT 1 FROM legal_cases c WHERE c.id = case_id
    AND c.office_id = case_assignments.office_id AND c.status = 'submitted')
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION set_own_oab(text, text), verify_lawyer_oab(text) TO juris_app;
  END IF;
END $$;
