-- Dados de base para o cliente escolher o advogado no fim do atendimento (PR seguinte, não feito
-- aqui): localização de atuação do advogado (distinta da OAB — a OAB diz onde a carteira foi
-- emitida, não onde ele atende hoje) e as áreas jurídicas que ele atende. Sem nenhuma dessas duas
-- coisas hoje, um diretório de advogados filtrável por área/local é impossível de montar.

-- cidade/uf aqui são sobre onde o advogado atua, nunca confundir com oab_uf (migração 0008).
ALTER TABLE profiles ADD COLUMN cidade text;
ALTER TABLE profiles ADD COLUMN uf text CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');

-- Um advogado pode atender mais de uma área (ex.: consumidor e cível). Sem FK para legal_area_id:
-- as áreas são uma lista fixa no código (lib/mocks/legal-areas.ts), nunca uma tabela própria —
-- mesmo padrão já usado em legal_cases.legal_area_id.
CREATE TABLE lawyer_areas (
  lawyer_id text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  legal_area_id uuid NOT NULL,
  PRIMARY KEY (lawyer_id, legal_area_id)
);
CREATE INDEX lawyer_areas_area_idx ON lawyer_areas(legal_area_id);

ALTER TABLE lawyer_areas ENABLE ROW LEVEL SECURITY;
-- O próprio advogado gerencia suas áreas; o admin do escritório só lê (mesmo padrão de
-- profile_self + admin_office_profiles em profiles, migração 0003). A listagem pública que o
-- cliente vai usar para escolher advogado nunca passa por aqui — sempre por
-- listar_advogados_disponiveis() abaixo, SECURITY DEFINER, que só expõe colunas não sensíveis.
CREATE POLICY lawyer_areas_self ON lawyer_areas FOR ALL USING (
  lawyer_id = app_actor_id()
) WITH CHECK (
  lawyer_id = app_actor_id()
);
CREATE POLICY lawyer_areas_admin_read ON lawyer_areas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = lawyer_areas.lawyer_id AND p.office_id = actor_office_id()
      AND actor_role() = 'admin'
  )
);

-- start_lawyer_trial (migração 0006, e-mail acrescentado em 0019) precisa gravar cidade/UF e as
-- áreas de atuação no mesmo cadastro — CREATE OR REPLACE não serve porque estamos acrescentando
-- parâmetros nesta versão, não só trocando o corpo.
DROP FUNCTION IF EXISTS start_lawyer_trial(uuid, text, text, text, text);
CREATE FUNCTION start_lawyer_trial(
  p_office_id uuid, p_nome text, p_cpf_cnpj text, p_plano text, p_email text,
  p_cidade text, p_uf text, p_areas uuid[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor text;
  tem_escritorio boolean;
  area_id uuid;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RAISE EXCEPTION 'login necessário';
  END IF;
  SELECT (p.office_id IS NOT NULL) INTO tem_escritorio FROM profiles p WHERE p.user_id = actor;
  IF tem_escritorio THEN
    RAISE EXCEPTION 'já existe cadastro profissional para esta conta';
  END IF;
  IF p_areas IS NULL OR array_length(p_areas, 1) IS NULL THEN
    RAISE EXCEPTION 'informe ao menos uma área de atuação';
  END IF;
  INSERT INTO offices(id, name, cpf_cnpj) VALUES (p_office_id, p_nome, p_cpf_cnpj);
  INSERT INTO profiles(user_id, role, office_id, email, cidade, uf)
    VALUES (actor, 'lawyer', p_office_id, p_email, p_cidade, upper(p_uf))
    ON CONFLICT (user_id) DO UPDATE SET role = 'lawyer', office_id = EXCLUDED.office_id,
      email = EXCLUDED.email, cidade = EXCLUDED.cidade, uf = EXCLUDED.uf;
  FOREACH area_id IN ARRAY p_areas LOOP
    INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES (actor, area_id)
      ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, plano_id)
    VALUES (actor, 'trial', now() + interval '7 days', 'asaas', p_plano);
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'start_lawyer_trial');
END $$;

-- Diretório público usado pelo cliente para escolher advogado (PR seguinte): só advogado com OAB
-- confirmada e assinatura ativa, filtrado por área (obrigatório) e opcionalmente por UF. SECURITY
-- DEFINER para não precisar abrir uma política de leitura ampla em profiles/lawyer_areas — só
-- expõe o que é seguro mostrar publicamente (nunca CPF, e-mail ou user_id de advogado alheio além
-- do necessário para montar o link do caso). ORDER BY random() evita viés: a mesma pessoa não
-- aparece sempre primeiro.
CREATE FUNCTION listar_advogados_disponiveis(p_area uuid, p_uf text DEFAULT NULL)
RETURNS TABLE(lawyer_id text, escritorio text, cidade text, uf text, oab_numero text, oab_uf text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.user_id, o.name, p.cidade, p.uf, p.oab_numero, p.oab_uf
  FROM profiles p
  JOIN lawyer_areas la ON la.lawyer_id = p.user_id
  JOIN offices o ON o.id = p.office_id
  WHERE la.legal_area_id = p_area
    AND p.role = 'lawyer'
    AND p.oab_verificado_em IS NOT NULL
    AND (p_uf IS NULL OR p.uf = upper(p_uf))
    AND EXISTS (
      SELECT 1 FROM lawyer_subscriptions s
      WHERE s.lawyer_id = p.user_id AND s.status IN ('active', 'trial') AND s.valid_until > now()
    )
  ORDER BY random()
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON lawyer_areas TO juris_app;
    GRANT EXECUTE ON FUNCTION
      start_lawyer_trial(uuid, text, text, text, text, text, text, uuid[]),
      listar_advogados_disponiveis(uuid, text)
      TO juris_app;
  END IF;
END $$;
