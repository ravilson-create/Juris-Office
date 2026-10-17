-- Layouts de /equipe e /atendimento fazem UPSERT do próprio e-mail no login.
-- Antes só havia SELECT/INSERT em profiles: o ramo ON CONFLICT DO UPDATE era negado.
-- A conta restrita pode alterar somente email; role/office_id/OAB continuam pelas
-- funções administrativas existentes, nunca por UPDATE direto do cliente.
CREATE POLICY profile_self_email_update ON profiles FOR UPDATE
  USING (user_id = app_actor_id())
  WITH CHECK (user_id = app_actor_id());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_runtime') THEN
    REVOKE UPDATE ON profiles FROM juris_runtime;
    GRANT UPDATE (email) ON profiles TO juris_runtime;
  END IF;
END $$;
