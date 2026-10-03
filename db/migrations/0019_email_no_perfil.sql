-- A tela de gestão de equipe (/equipe/time) só tinha profiles.user_id para identificar cada
-- membro — e esse id é o identificador opaco da Neon Auth (um UUID), não algo que a pessoa
-- reconheça. Guardamos o e-mail aqui, no próprio app, em vez de consultar a API administrativa
-- da Neon Auth a cada listagem: mais simples, funciona igual em teste (PGlite) e produção, e não
-- depende de nenhuma permissão extra configurada do lado da Neon Auth.
ALTER TABLE profiles ADD COLUMN email text;

-- start_lawyer_trial (migração 0006) precisa gravar o e-mail já no momento do cadastro —
-- CREATE OR REPLACE exige os mesmos parâmetros da versão antiga; como estamos acrescentando um,
-- a função precisa ser recriada (DROP + CREATE), não só substituída. Corpo idêntico ao original,
-- só com p_email adicionado ao INSERT em profiles.
DROP FUNCTION IF EXISTS start_lawyer_trial(uuid, text, text, text);
CREATE FUNCTION start_lawyer_trial(
  p_office_id uuid, p_nome text, p_cpf_cnpj text, p_plano text, p_email text
)
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
  INSERT INTO profiles(user_id, role, office_id, email) VALUES (actor, 'lawyer', p_office_id, p_email)
    ON CONFLICT (user_id) DO UPDATE SET role = 'lawyer', office_id = EXCLUDED.office_id,
      email = EXCLUDED.email;
  INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, plano_id)
    VALUES (actor, 'trial', now() + interval '7 days', 'asaas', p_plano);
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'start_lawyer_trial');
END $$;
