-- Cadastro profissional self-service: advogado logado (Neon Auth) escolhe plano, informa
-- CPF/CNPJ do escritório e ganha 7 dias de teste — espelha o fluxo de POST /api/cadastro do
-- fiscal-sinapi-local (trial + Asaas), mas por cima da identidade já verificada pelo Neon Auth
-- em vez de criar login próprio. A promoção de perfil (citizen -> lawyer) só acontece dentro de
-- start_lawyer_trial(): nunca por INSERT/UPDATE direto em profiles a partir do formulário.
ALTER TABLE offices ADD COLUMN cpf_cnpj text UNIQUE
  CHECK (cpf_cnpj IS NULL OR cpf_cnpj ~ '^[0-9]{11}$' OR cpf_cnpj ~ '^[0-9]{14}$');

ALTER TABLE lawyer_subscriptions
  ALTER COLUMN external_ref DROP NOT NULL,
  ADD COLUMN plano_id text,
  ADD COLUMN invoice_url text,
  ADD COLUMN gateway_customer_id text,
  ADD COLUMN cancelar_em_renovacao boolean NOT NULL DEFAULT false;
ALTER TABLE lawyer_subscriptions DROP CONSTRAINT lawyer_subscriptions_status_check;
ALTER TABLE lawyer_subscriptions ADD CONSTRAINT lawyer_subscriptions_status_check
  CHECK (status IN ('trial','active','past_due','canceled'));

-- Teste grátis conta como acesso válido, igual a uma assinatura paga em dia.
CREATE OR REPLACE FUNCTION has_active_subscription(lawyer text) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM lawyer_subscriptions s WHERE s.lawyer_id = lawyer
    AND s.status IN ('active', 'trial') AND s.valid_until > now())
$$;

-- Cria o escritório do próprio usuário autenticado, promove o perfil a advogado e abre o
-- trial de 7 dias. Rejeita se a conta já tiver escritório (idempotência contra duplo clique /
-- reenvio do formulário) — nunca cria um segundo escritório para a mesma conta.
CREATE FUNCTION start_lawyer_trial(p_office_id uuid, p_nome text, p_cpf_cnpj text, p_plano text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor text;
  tem_escritorio boolean;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'login necessário';
  END IF;
  SELECT (p.office_id IS NOT NULL) INTO tem_escritorio FROM profiles p WHERE p.user_id = actor;
  IF tem_escritorio THEN
    RAISE EXCEPTION 'já existe cadastro profissional para esta conta';
  END IF;
  INSERT INTO offices(id, name, cpf_cnpj) VALUES (p_office_id, p_nome, p_cpf_cnpj);
  INSERT INTO profiles(user_id, role, office_id) VALUES (actor, 'lawyer', p_office_id)
    ON CONFLICT (user_id) DO UPDATE SET role = 'lawyer', office_id = EXCLUDED.office_id;
  INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, plano_id)
    VALUES (actor, 'trial', now() + interval '7 days', 'asaas', p_plano);
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'start_lawyer_trial');
END $$;

-- Três ações self-service da própria assinatura (sem perfil admin: cada advogado só mexe na
-- sua). "cancelar" não revoga o acesso na hora — só marca para não renovar; o acesso cai
-- sozinho quando valid_until vencer, via has_active_subscription().
CREATE FUNCTION set_own_subscription_gateway(p_customer_id text, p_subscription_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE lawyer_subscriptions SET gateway_customer_id = p_customer_id, external_ref = p_subscription_id,
    updated_at = now()
  WHERE lawyer_id = app_actor_id()
$$;
CREATE FUNCTION set_own_subscription_invoice(p_invoice_url text, p_valid_until timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE lawyer_subscriptions SET invoice_url = p_invoice_url, valid_until = p_valid_until,
    updated_at = now()
  WHERE lawyer_id = app_actor_id()
$$;
CREATE FUNCTION cancel_own_subscription() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE lawyer_subscriptions SET cancelar_em_renovacao = true, updated_at = now()
  WHERE lawyer_id = app_actor_id()
$$;
CREATE FUNCTION set_own_subscription_plan(p_plano text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE lawyer_subscriptions SET plano_id = p_plano, updated_at = now()
  WHERE lawyer_id = app_actor_id() AND NOT cancelar_em_renovacao
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION
      start_lawyer_trial(uuid, text, text, text),
      set_own_subscription_gateway(text, text),
      set_own_subscription_invoice(text, timestamptz),
      cancel_own_subscription(),
      set_own_subscription_plan(text)
    TO juris_app;
  END IF;
END $$;
