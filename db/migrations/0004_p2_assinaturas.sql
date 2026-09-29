-- O acesso profissional exige assinatura ativa. Somente o operador de cobrança,
-- usando a conexão administrativa, pode conceder/revogar o benefício.
CREATE TABLE lawyer_subscriptions (
  lawyer_id text PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('active','past_due','canceled')),
  valid_until timestamptz NOT NULL,
  provider text NOT NULL,
  external_ref text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lawyer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscription_read ON lawyer_subscriptions FOR SELECT USING (
  lawyer_id = app_actor_id() OR (actor_role() = 'admin' AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = lawyer_id AND p.office_id = actor_office_id()
  ))
);

CREATE FUNCTION has_active_subscription(lawyer text) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM lawyer_subscriptions s WHERE s.lawyer_id = lawyer
    AND s.status = 'active' AND s.valid_until > now())
$$;
CREATE OR REPLACE FUNCTION can_read_case(target uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT app_actor_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM legal_cases c WHERE c.id = target AND (
      c.citizen_id = app_actor_id() OR EXISTS (
        SELECT 1 FROM case_assignments a JOIN profiles p ON p.user_id = app_actor_id()
        WHERE a.case_id = c.id AND a.office_id = p.office_id AND (
          (p.role = 'lawyer' AND a.lawyer_id = p.user_id
            AND has_active_subscription(p.user_id)) OR p.role = 'admin'
        )
      ) OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = app_actor_id()
        AND p.role = 'admin' AND p.office_id = c.office_id)
    )
  )
$$;
DROP POLICY assignment_admin_insert ON case_assignments;
CREATE POLICY assignment_admin_insert ON case_assignments FOR INSERT WITH CHECK (
  actor_role() = 'admin' AND actor_office_id() = case_assignments.office_id
  AND EXISTS (SELECT 1 FROM profiles lawyer WHERE lawyer.user_id = lawyer_id
    AND lawyer.role = 'lawyer' AND lawyer.office_id = case_assignments.office_id)
  AND has_active_subscription(lawyer_id)
  AND EXISTS (SELECT 1 FROM legal_cases c WHERE c.id = case_id
    AND c.office_id = case_assignments.office_id AND c.status = 'submitted')
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT ON lawyer_subscriptions TO juris_app;
    GRANT EXECUTE ON FUNCTION has_active_subscription(text) TO juris_app;
  END IF;
END $$;
