-- MFA por TOTP para quem acessa a área profissional (Portal do Advogado, PR7).
--
-- O segredo e os códigos de backup ficam numa tabela própria, não em colunas de `profiles`: a
-- política `admin_office_profiles` (0003) deixa um admin ler o perfil de qualquer advogado do
-- escritório, e um `SELECT *` ali vazaria segredo de TOTP e códigos de backup de outra pessoa.
-- Em `profile_mfa` só existe a política de dono — nem admin lê o segredo de outro.
CREATE TABLE profile_mfa (
  user_id text PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  secret text NOT NULL,
  enabled_at timestamptz,
  backup_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profile_mfa ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_self ON profile_mfa FOR SELECT USING (user_id = app_actor_id());

-- Toda escrita passa por função SECURITY DEFINER restrita a app_actor_id() — mesmo padrão de
-- set_own_oab (0008): sem política de INSERT/UPDATE/DELETE em profile_mfa, ninguém grava nela
-- por uma query comum, só por estas funções.
CREATE FUNCTION enroll_own_mfa(p_secret text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'login necessário';
  END IF;
  INSERT INTO profile_mfa(user_id, secret, enabled_at, backup_codes)
  VALUES (actor, p_secret, NULL, '{}')
  ON CONFLICT (user_id) DO UPDATE SET
    secret = excluded.secret, enabled_at = NULL, backup_codes = '{}';
END $$;

-- Só confirma (liga de fato o MFA) quem já passou por enroll_own_mfa — nunca liga a partir do
-- nada, para sempre exigir que o código tenha sido validado contra o segredo antes.
CREATE FUNCTION confirm_own_mfa(p_backup_codes text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'login necessário';
  END IF;
  UPDATE profile_mfa SET enabled_at = now(), backup_codes = p_backup_codes
  WHERE user_id = actor AND secret IS NOT NULL;
END $$;

CREATE FUNCTION disable_own_mfa() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'login necessário';
  END IF;
  DELETE FROM profile_mfa WHERE user_id = actor;
END $$;

-- Cada código de backup só funciona uma vez: a verificação já remove o código da lista na mesma
-- chamada, nunca como um passo separado que alguém poderia esquecer de fazer.
CREATE FUNCTION consume_own_mfa_backup_code(p_code_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; achou boolean;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RETURN false;
  END IF;
  SELECT p_code_hash = ANY(backup_codes) INTO achou FROM profile_mfa WHERE user_id = actor;
  IF achou THEN
    UPDATE profile_mfa SET backup_codes = array_remove(backup_codes, p_code_hash)
    WHERE user_id = actor;
  END IF;
  RETURN coalesce(achou, false);
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT ON profile_mfa TO juris_app;
    GRANT EXECUTE ON FUNCTION
      enroll_own_mfa(text), confirm_own_mfa(text[]), disable_own_mfa(), consume_own_mfa_backup_code(text)
      TO juris_app;
  END IF;
END $$;
