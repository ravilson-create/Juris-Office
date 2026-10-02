-- Gestão de equipe (Portal do Advogado, PR8). profiles nunca ganhou política de UPDATE (0003) —
-- promover, rebaixar ou remover alguém da equipe sempre passou por função SECURITY DEFINER, no
-- mesmo padrão de set_own_oab/verify_lawyer_oab (0008). Esta migração acrescenta as três que
-- faltavam para administrar o próprio time, todas restritas a admin do mesmo escritório do alvo,
-- e todas protegendo o invariante "todo escritório com equipe tem ao menos um admin".

CREATE FUNCTION office_admin_count(p_office_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::int FROM profiles WHERE office_id = p_office_id AND role = 'admin'
$$;

CREATE FUNCTION promote_to_admin(p_lawyer_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; actor_office uuid;
BEGIN
  actor := app_actor_id();
  SELECT office_id INTO actor_office FROM profiles WHERE user_id = actor AND role = 'admin';
  IF actor_office IS NULL THEN
    RAISE EXCEPTION 'apenas administradores do escritório promovem a admin';
  END IF;
  UPDATE profiles SET role = 'admin'
  WHERE user_id = p_lawyer_id AND role = 'lawyer' AND office_id = actor_office;
  IF FOUND THEN
    INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'promote_to_admin:' || p_lawyer_id);
  END IF;
END $$;

-- Nunca deixa o escritório sem nenhum admin: a própria equipe ficaria sem ninguém para
-- administrar — incluindo desfazer esta mudança.
CREATE FUNCTION demote_to_lawyer(p_admin_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; actor_office uuid;
BEGIN
  actor := app_actor_id();
  SELECT office_id INTO actor_office FROM profiles WHERE user_id = actor AND role = 'admin';
  IF actor_office IS NULL THEN
    RAISE EXCEPTION 'apenas administradores do escritório rebaixam a advogado';
  END IF;
  IF office_admin_count(actor_office) <= 1 THEN
    RAISE EXCEPTION 'o escritório precisa manter ao menos um administrador';
  END IF;
  UPDATE profiles SET role = 'lawyer'
  WHERE user_id = p_admin_id AND role = 'admin' AND office_id = actor_office;
  IF FOUND THEN
    INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'demote_to_lawyer:' || p_admin_id);
  END IF;
END $$;

-- Remover da equipe devolve a pessoa a 'citizen' sem escritório (nunca apaga o perfil — ela pode
-- ter atendimentos próprios como cidadã) e libera de volta os casos que estavam só com ela, para
-- o escritório reatribuir.
CREATE FUNCTION remove_from_office(p_user_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; actor_office uuid; target_role text;
BEGIN
  actor := app_actor_id();
  SELECT office_id INTO actor_office FROM profiles WHERE user_id = actor AND role = 'admin';
  IF actor_office IS NULL THEN
    RAISE EXCEPTION 'apenas administradores do escritório removem alguém da equipe';
  END IF;
  SELECT role INTO target_role FROM profiles
  WHERE user_id = p_user_id AND office_id = actor_office AND role IN ('lawyer', 'admin');
  IF target_role IS NULL THEN
    RETURN;
  END IF;
  IF target_role = 'admin' AND office_admin_count(actor_office) <= 1 THEN
    RAISE EXCEPTION 'o escritório precisa manter ao menos um administrador';
  END IF;
  DELETE FROM case_assignments WHERE lawyer_id = p_user_id AND office_id = actor_office;
  UPDATE profiles SET role = 'citizen', office_id = NULL,
    oab_numero = NULL, oab_uf = NULL, oab_verificado_em = NULL, oab_verificado_por = NULL
  WHERE user_id = p_user_id;
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'remove_from_office:' || p_user_id);
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION
      office_admin_count(uuid), promote_to_admin(text), demote_to_lawyer(text), remove_from_office(text)
      TO juris_app;
  END IF;
END $$;
