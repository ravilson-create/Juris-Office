-- Convite de equipe: o advogado que cadastra o escritório (admin) monta o time convidando por
-- e-mail, escolhendo "advogado" (exige CPF e OAB) ou "administrativo" (só CPF). Ninguém além da
-- própria Neon Auth pode criar login para outra pessoa — o convite fica pendente até a pessoa
-- convidada logar com esse e-mail, quando aceitar_convite_equipe() a vincula ao escritório.
--
-- PR seguinte dá ao "administrativo" o mesmo acesso de leitura/gestão de caso que o advogado tem
-- hoje (só não assina) — mexe em muita política de RLS espalhada, fica separado para revisar.
-- Por ora, um perfil 'staff' recém-aceito não enxerga nenhum caso (mesma regra que já vale para
-- 'citizen'), só existe na equipe.

ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('citizen', 'lawyer', 'admin', 'staff'));

-- CPF da própria pessoa da equipe (distinto do CPF do cidadão interessado, que mora em
-- legal_cases.applicant — este aqui identifica quem presta serviço no escritório).
ALTER TABLE profiles ADD COLUMN cpf text CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');

CREATE TABLE office_invites (
  id uuid PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES offices(id),
  email text NOT NULL CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text NOT NULL CHECK (role IN ('lawyer', 'staff')),
  cpf text NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  oab_numero text,
  oab_uf text CHECK (oab_uf IS NULL OR oab_uf ~ '^[A-Z]{2}$'),
  -- advogado exige OAB; administrativo nunca tem OAB — mesma regra do formulário, reforçada aqui.
  CONSTRAINT office_invites_oab_por_papel CHECK (
    (role = 'lawyer' AND oab_numero IS NOT NULL AND oab_uf IS NOT NULL) OR
    (role = 'staff' AND oab_numero IS NULL AND oab_uf IS NULL)
  ),
  invited_by text NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by text REFERENCES profiles(user_id)
);
-- Só um convite pendente por e-mail e escritório de cada vez; reconvidar atualiza o existente
-- (ver convidar_membro_equipe) em vez de duplicar.
CREATE UNIQUE INDEX office_invites_pending_email ON office_invites (office_id, lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE office_invites ENABLE ROW LEVEL SECURITY;
-- Só o admin do próprio escritório vê/mexe nos convites dele — carregam CPF e OAB de gente que
-- ainda nem tem conta, não é dado para circular.
CREATE POLICY office_invites_admin ON office_invites FOR ALL USING (
  actor_role() = 'admin' AND office_id = actor_office_id()
) WITH CHECK (
  actor_role() = 'admin' AND office_id = actor_office_id()
);

-- p_invite_id vem do Node (randomUUID()), mesmo padrão já usado por contracts/deadlines/etc. —
-- o projeto não usa gen_random_uuid() em nenhum outro lugar, evita depender de pgcrypto/PG13+.
CREATE FUNCTION convidar_membro_equipe(
  p_invite_id uuid, p_email text, p_role text, p_cpf text, p_oab_numero text, p_oab_uf text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; actor_office uuid; ocupantes int;
BEGIN
  actor := app_actor_id();
  SELECT office_id INTO actor_office FROM profiles WHERE user_id = actor AND role = 'admin';
  IF actor_office IS NULL THEN
    RAISE EXCEPTION 'apenas administradores do escritório convidam membros';
  END IF;
  -- "até 5 funcionários": conta quem já está na equipe (exceto o próprio admin dono) mais quem
  -- tem convite pendente — nunca deixa passar de 5 ao mesmo tempo.
  SELECT count(*) INTO ocupantes FROM profiles WHERE office_id = actor_office AND role IN ('lawyer', 'staff');
  SELECT ocupantes + count(*) INTO ocupantes FROM office_invites
    WHERE office_id = actor_office AND accepted_at IS NULL;
  IF ocupantes >= 5 THEN
    RAISE EXCEPTION 'o escritório já tem 5 funcionários (contando convites pendentes)';
  END IF;
  INSERT INTO office_invites(id, office_id, email, role, cpf, oab_numero, oab_uf, invited_by)
    VALUES (p_invite_id, actor_office, lower(p_email), p_role, p_cpf,
      p_oab_numero, upper(p_oab_uf), actor)
    ON CONFLICT (office_id, lower(email)) WHERE accepted_at IS NULL DO UPDATE SET
      role = EXCLUDED.role, cpf = EXCLUDED.cpf,
      oab_numero = EXCLUDED.oab_numero, oab_uf = EXCLUDED.oab_uf;
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'convidar_membro_equipe:' || lower(p_email));
END $$;

CREATE FUNCTION cancelar_convite_equipe(p_invite_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; actor_office uuid;
BEGIN
  actor := app_actor_id();
  SELECT office_id INTO actor_office FROM profiles WHERE user_id = actor AND role = 'admin';
  IF actor_office IS NULL THEN
    RAISE EXCEPTION 'apenas administradores do escritório cancelam convites';
  END IF;
  DELETE FROM office_invites
    WHERE id = p_invite_id AND office_id = actor_office AND accepted_at IS NULL;
END $$;

-- Chamada a cada login (ver lib/auth/aceitar-convite.ts), sempre com o e-mail que a própria Neon
-- Auth confirmou para a sessão — nunca um valor vindo de formulário. Sem convite pendente, não
-- faz nada (caminho comum, a maioria dos logins). Não atropela quem já tem escritório: a pessoa
-- precisaria sair da equipe atual antes (remove_from_office) para aceitar outro convite.
--
-- O número da OAB aqui foi digitado pelo admin que convidou, não pela própria pessoa — por isso
-- oab_verificado_por grava quem convidou (um humano real, ainda que não tenha checado o número
-- contra o cadastro oficial), não a própria pessoa como na autodeclaração do cadastro self-service
-- (migração 0020, set_own_oab).
CREATE FUNCTION aceitar_convite_equipe(p_email text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; convite office_invites%ROWTYPE; tem_escritorio boolean;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN RETURN; END IF;
  SELECT (office_id IS NOT NULL) INTO tem_escritorio FROM profiles WHERE user_id = actor;
  IF tem_escritorio THEN RETURN; END IF;
  SELECT * INTO convite FROM office_invites
    WHERE lower(email) = lower(p_email) AND accepted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  IF convite.id IS NULL THEN RETURN; END IF;
  UPDATE profiles SET role = convite.role, office_id = convite.office_id, cpf = convite.cpf,
    oab_numero = convite.oab_numero, oab_uf = convite.oab_uf,
    oab_verificado_em = CASE WHEN convite.role = 'lawyer' THEN now() ELSE NULL END,
    oab_verificado_por = CASE WHEN convite.role = 'lawyer' THEN convite.invited_by ELSE NULL END
    WHERE user_id = actor;
  UPDATE office_invites SET accepted_at = now(), accepted_by = actor WHERE id = convite.id;
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'aceitar_convite_equipe');
END $$;

-- remove_from_office (migração 0015) só soltava 'lawyer'/'admin' e nunca limpava o CPF — agora
-- também solta 'staff' e limpa o CPF junto com a OAB (tudo dado ligado a estar na equipe).
CREATE OR REPLACE FUNCTION remove_from_office(p_user_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; actor_office uuid; target_role text;
BEGIN
  actor := app_actor_id();
  SELECT office_id INTO actor_office FROM profiles WHERE user_id = actor AND role = 'admin';
  IF actor_office IS NULL THEN
    RAISE EXCEPTION 'apenas administradores do escritório removem alguém da equipe';
  END IF;
  SELECT role INTO target_role FROM profiles
    WHERE user_id = p_user_id AND office_id = actor_office AND role IN ('lawyer', 'admin', 'staff');
  IF target_role IS NULL THEN
    RETURN;
  END IF;
  IF target_role = 'admin' AND office_admin_count(actor_office) <= 1 THEN
    RAISE EXCEPTION 'o escritório precisa manter ao menos um administrador';
  END IF;
  DELETE FROM case_assignments WHERE lawyer_id = p_user_id AND office_id = actor_office;
  UPDATE profiles SET role = 'citizen', office_id = NULL, cpf = NULL,
    oab_numero = NULL, oab_uf = NULL, oab_verificado_em = NULL, oab_verificado_por = NULL
  WHERE user_id = p_user_id;
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'remove_from_office:' || p_user_id);
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON office_invites TO juris_app;
    GRANT EXECUTE ON FUNCTION
      convidar_membro_equipe(uuid, text, text, text, text, text),
      cancelar_convite_equipe(uuid),
      aceitar_convite_equipe(text)
      TO juris_app;
  END IF;
END $$;
