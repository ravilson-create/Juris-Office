-- Decisão do dono do produto: a OAB deixa de exigir confirmação manual de um admin antes de
-- liberar acesso a casos — passa a confirmar sozinha, no momento do cadastro. Como não existe
-- forma de validar uma OAB automaticamente (ver comentário da migração 0008: sem dígito
-- verificador público, só consulta manual em cna.oab.org.br), essa "confirmação" é uma
-- autodeclaração, não uma checagem de verdade.
--
-- Para não esconder isso, a trilha continua guardando quem confirmou (oab_verificado_por) —
-- só que agora, no cadastro, é a própria pessoa. A tela de equipe usa
-- "oab_verificado_por = user_id" para rotular como "autodeclarada" (nunca conferida por humano),
-- em vez de "confirmada". Um admin que desconfiar de um número pode revogar com
-- revoke_lawyer_oab(): volta a pendente, bloqueia o acesso de novo, e só libera outra vez depois
-- de verify_lawyer_oab() — a mesma função de sempre, que já registra o admin de verdade como
-- verificador.
CREATE OR REPLACE FUNCTION set_own_oab(p_oab_numero text, p_oab_uf text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'login necessário';
  END IF;
  UPDATE profiles SET oab_numero = p_oab_numero, oab_uf = upper(p_oab_uf),
    oab_verificado_em = now(), oab_verificado_por = actor
  WHERE user_id = actor AND role = 'lawyer';
END $$;

-- Espelha verify_lawyer_oab: só admin do mesmo escritório, só sobre advogado do escritório.
-- Volta ao estado "sem OAB confirmada" — o advogado perde acesso a casos até alguém confirmar
-- de novo (autodeclarando outra vez ou via verify_lawyer_oab, depois de checar manualmente).
CREATE FUNCTION revoke_lawyer_oab(p_lawyer_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL OR actor_role() <> 'admin' THEN
    RAISE EXCEPTION 'apenas administradores do escritório revogam a OAB';
  END IF;
  UPDATE profiles SET oab_verificado_em = NULL, oab_verificado_por = NULL
  WHERE user_id = p_lawyer_id AND role = 'lawyer' AND office_id = actor_office_id();
  IF FOUND THEN
    INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'revoke_lawyer_oab:' || p_lawyer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION revoke_lawyer_oab(text) TO juris_app;
  END IF;
END $$;
