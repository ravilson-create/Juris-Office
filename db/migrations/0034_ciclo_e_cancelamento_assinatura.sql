-- Ciclo de cobrança e cancelamento ao fim do período contratado.
ALTER TABLE lawyer_subscriptions
  ADD COLUMN billing_cycle text NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_cycle IN ('MONTHLY','YEARLY')),
  ADD COLUMN period_started_at timestamptz,
  ADD COLUMN cancellation_requested_at timestamptz;

UPDATE lawyer_subscriptions
SET billing_cycle = CASE WHEN plano_id = 'yearly' THEN 'YEARLY' ELSE 'MONTHLY' END
WHERE plano_id IS NOT NULL;

CREATE OR REPLACE FUNCTION cancel_own_subscription() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE lawyer_subscriptions
  SET cancelar_em_renovacao = true,
      cancellation_requested_at = COALESCE(cancellation_requested_at, now()),
      updated_at = now()
  WHERE lawyer_id = app_actor_id()
$$;

CREATE OR REPLACE FUNCTION set_own_subscription_plan(p_plano text, p_cycle text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_plano NOT IN ('monthly','yearly') OR p_cycle NOT IN ('MONTHLY','YEARLY') THEN
    RAISE EXCEPTION 'plano/ciclo inválido';
  END IF;
  UPDATE lawyer_subscriptions
  SET plano_id = p_plano, billing_cycle = p_cycle, updated_at = now()
  WHERE lawyer_id = app_actor_id() AND NOT cancelar_em_renovacao;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION cancel_own_subscription(), set_own_subscription_plan(text, text)
      TO juris_app;
  END IF;
END $$;
