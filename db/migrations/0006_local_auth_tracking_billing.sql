-- Contas profissionais e sessões revogáveis. Sem confirmação de e-mail obrigatória.
CREATE TABLE professional_accounts (
 id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL,
 password_hash text NOT NULL, cpf_cnpj text, oab_number text, oab_state text,
 enabled boolean NOT NULL DEFAULT true, terms_accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX professional_oab_unique ON professional_accounts(oab_state, oab_number)
 WHERE oab_number IS NOT NULL;
CREATE TABLE professional_sessions (
 token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES professional_accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX professional_sessions_user ON professional_sessions(user_id);
ALTER TABLE professional_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_sessions ENABLE ROW LEVEL SECURITY;
-- Estas tabelas privadas são acessadas somente pelo serviço de autenticação no servidor.
REVOKE ALL ON professional_accounts, professional_sessions FROM PUBLIC;

CREATE TABLE case_tracking_tokens (
 case_id uuid PRIMARY KEY REFERENCES legal_cases(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE case_tracking_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON case_tracking_tokens FROM PUBLIC;
CREATE TABLE case_public_updates (
 id uuid PRIMARY KEY, case_id uuid NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
 status text NOT NULL, message text NOT NULL DEFAULT '', actor_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE case_public_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_updates_read ON case_public_updates FOR SELECT USING (can_read_case(case_id));
CREATE POLICY public_updates_write ON case_public_updates FOR INSERT WITH CHECK (
 actor_id = app_actor_id() AND actor_role() IN ('lawyer','admin') AND can_read_case(case_id)
);
-- Somente casos atribuídos e assinatura válida permitem atuação do advogado.
CREATE POLICY professional_case_update ON legal_cases FOR UPDATE
 USING (actor_role() IN ('lawyer','admin') AND can_read_case(id))
 WITH CHECK (actor_role() IN ('lawyer','admin') AND can_read_case(id));

CREATE TABLE billing_accounts (
 lawyer_id text PRIMARY KEY REFERENCES profiles(user_id), plan_id text NOT NULL CHECK(plan_id IN ('monthly','yearly')),
 customer_id text, subscription_id text UNIQUE, invoice_url text,
 state text NOT NULL DEFAULT 'pending', cancel_requested boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE billing_events (id text PRIMARY KEY, event_type text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_self_read ON billing_accounts FOR SELECT USING(lawyer_id = app_actor_id());
REVOKE ALL ON billing_events FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='juris_app') THEN
  GRANT SELECT ON billing_accounts TO juris_app;
  GRANT SELECT, INSERT ON case_public_updates TO juris_app;
 END IF;
END $$;
