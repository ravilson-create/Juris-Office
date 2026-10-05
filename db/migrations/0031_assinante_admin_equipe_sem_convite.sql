-- Reorganiza quem pode o quê no escritório, a pedido do dono do produto:
--
-- 1) Quem assina o Júris Office (cria o escritório) nasce 'admin', não 'lawyer' — hoje ele não
--    conseguia gerenciar a própria equipe nem confirmar OAB de ninguém, porque essas telas e
--    funções exigem role = 'admin' e start_lawyer_trial só dava 'lawyer'.
-- 2) A assinatura (mensalidade) passa a valer pelo ESCRITÓRIO (há um admin com assinatura ativa),
--    não por advogado individual — hoje um advogado convidado para a equipe nunca ganhava sua
--    própria linha em lawyer_subscriptions, então nunca conseguia de fato ler um caso atribuído a
--    ele (gap que a própria migração 0021 deixou anotado e nunca fechou). 'admin' também passa a
--    precisar da assinatura do escritório — antes ficava isento, o que não faz sentido quando o
--    admin é justamente quem assina.
-- 3) Elaborar (ler caso, anotar, redigir petição/peça, prazo, parcela, rascunho de contrato) abre
--    para qualquer membro da equipe (lawyer/admin/staff, 'staff' sem nunca ter OAB) — hoje 'staff'
--    não enxergava caso nenhum. Excluir (apagar atendimento/contrato) continua restrito a
--    lawyer/admin: é mais destrutivo que elaborar, não foi pedido para 'staff'.
-- 4) Assinar (contrato como responsável, e agora também petição/peça) passa a exigir
--    oab_verificado_em preenchido, independente do papel (lawyer ou admin) — hoje um admin sem
--    OAB nenhuma já podia assinar contrato como responsável.
-- 5) Petição/peça (case_petitions, a mesma tabela para as duas — migração 0025) ganha
--    finalizado_em/finalizado_por: um "assinar" interno da plataforma, que trava novas edições
--    daquela versão. Isto NÃO é a assinatura que vale para protocolar em juízo — essa continua
--    sendo o certificado ICP-Brasil do próprio advogado ou o login do sistema do tribunal,
--    fora desta plataforma. É só a confirmação de quem, no escritório, autorizou aquela versão.
-- 6) Convite por e-mail sai de uso (ver app/equipe/time/page.tsx e actions): o admin passa a
--    cadastrar o membro direto, com conta já criada e ativa. office_invites e as funções de
--    convite continuam existindo (não vale a pena arriscar DROP em produção por um convite que já
--    possa estar pendente), só deixam de ser oferecidas na tela.

-- ------------------------------------------------------------------ 1) fundador nasce admin

CREATE OR REPLACE FUNCTION start_lawyer_trial(
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
  -- 'admin', não 'lawyer': quem assina é quem administra o próprio escritório desde o primeiro
  -- dia — gestão de equipe, confirmação de OAB de quem ele mesmo cadastrar, atribuição de casos.
  INSERT INTO profiles(user_id, role, office_id, email, cidade, uf)
    VALUES (actor, 'admin', p_office_id, p_email, p_cidade, upper(p_uf))
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin', office_id = EXCLUDED.office_id,
      email = EXCLUDED.email, cidade = EXCLUDED.cidade, uf = EXCLUDED.uf;
  FOREACH area_id IN ARRAY p_areas LOOP
    INSERT INTO lawyer_areas(lawyer_id, legal_area_id) VALUES (actor, area_id)
      ON CONFLICT DO NOTHING;
  END LOOP;
  INSERT INTO lawyer_subscriptions(lawyer_id, status, valid_until, provider, plano_id)
    VALUES (actor, 'trial', now() + interval '7 days', 'asaas', p_plano);
  INSERT INTO audit_logs(actor_id, action) VALUES (actor, 'start_lawyer_trial');
END $$;

-- set_own_oab (migração 0020) só autodeclarava para role = 'lawyer' — o fundador agora é 'admin'
-- e precisa do mesmo caminho de autodeclaração (ninguém mais pode confirmar a OAB de quem já é o
-- único admin do próprio escritório).
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
  WHERE user_id = actor AND role IN ('lawyer', 'admin');
END $$;

-- ------------------------------------------------------------------ 2) assinatura por escritório

-- Existe algum admin deste escritório com assinatura ativa — é quem, no modelo novo, paga pela
-- equipe inteira. Qualquer membro (lawyer/admin/staff) trabalha enquanto isto for verdade.
CREATE FUNCTION office_has_active_subscription(p_office_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.office_id = p_office_id AND p.role = 'admin' AND has_active_subscription(p.user_id)
  )
$$;

-- A OAB confirmada do próprio ator, como gate de ASSINAR (contrato, petição, peça) — nunca de
-- leitura/elaboração. Vale para 'lawyer' e 'admin' por igual: o papel não diz quem tem OAB, o
-- campo oab_verificado_em diz.
CREATE FUNCTION actor_oab_confirmada() RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = app_actor_id() AND oab_verificado_em IS NOT NULL
  )
$$;

-- Substitui a versão da migração 0008 (owns_case OR ...). 'lawyer' continua restrito ao caso que
-- lhe foi atribuído; 'admin' e agora 'staff' veem qualquer caso do próprio escritório — a
-- diferença entre os três não é mais "quem tem OAB" nem "quem tem assinatura própria", é só se a
-- ASSINATURA DO ESCRITÓRIO está em dia. Sem ela, ninguém do escritório lê caso nenhum.
CREATE OR REPLACE FUNCTION can_read_case(target uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT owns_case(target) OR (
    app_actor_id() IS NOT NULL AND EXISTS (
      SELECT 1 FROM legal_cases c WHERE c.id = target AND (
        EXISTS (
          SELECT 1 FROM case_assignments a JOIN profiles p ON p.user_id = app_actor_id()
          WHERE a.case_id = c.id AND a.office_id = p.office_id AND p.role = 'lawyer'
            AND a.lawyer_id = p.user_id AND office_has_active_subscription(p.office_id)
        )
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = app_actor_id()
          AND p.role IN ('admin', 'staff') AND p.office_id = c.office_id
          AND office_has_active_subscription(p.office_id))
      )
    )
  )
$$;

-- assignment_admin_insert (0012): a assinatura exigida passa a ser a do escritório, não a do
-- advogado-alvo (que pode nunca ter a própria). A OAB confirmada do advogado-alvo continua
-- exigida aqui — atribuição formal de responsabilidade pelo caso é diferente de só elaborar.
DROP POLICY assignment_admin_insert ON case_assignments;
CREATE POLICY assignment_admin_insert ON case_assignments FOR INSERT WITH CHECK (
  actor_role() = 'admin' AND actor_office_id() = case_assignments.office_id
  AND EXISTS (SELECT 1 FROM profiles lawyer WHERE lawyer.user_id = lawyer_id
    AND lawyer.role = 'lawyer' AND lawyer.office_id = case_assignments.office_id
    AND lawyer.oab_verificado_em IS NOT NULL)
  AND office_has_active_subscription(case_assignments.office_id)
  AND EXISTS (SELECT 1 FROM legal_cases c WHERE c.id = case_id
    AND c.office_id = case_assignments.office_id AND c.status = 'submitted')
);

-- ------------------------------------------------------------------ 3) elaboração abre para 'staff'

-- Adiciona a coluna aqui (antes de petitions_access, abaixo, referenciá-la) — o resto do
-- controle de "finalizar e assinar" (função, GRANT) só vem na seção 5, mais abaixo, perto de
-- onde faz sentido explicar; a coluna em si precisa existir antes.
ALTER TABLE case_petitions
  ADD COLUMN finalizado_em timestamptz,
  ADD COLUMN finalizado_por text REFERENCES profiles(user_id);

ALTER POLICY professional_notes_read ON case_notes USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
);
ALTER POLICY professional_notes_insert ON case_notes WITH CHECK (
  author_id = app_actor_id() AND actor_role() IN ('lawyer', 'admin', 'staff')
  AND can_read_case(case_id)
);

ALTER POLICY petitions_access ON case_petitions USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
) WITH CHECK (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
  -- uma vez assinada (ver seção 5 abaixo), a versão não aceita mais UPDATE — só uma nova versão.
  AND finalizado_em IS NULL
);

ALTER POLICY deadlines_read ON deadlines USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
);
ALTER POLICY deadlines_insert ON deadlines WITH CHECK (
  created_by = app_actor_id() AND actor_role() IN ('lawyer', 'admin', 'staff')
  AND can_read_case(case_id)
);

ALTER POLICY viability_read ON case_viability USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
);
ALTER POLICY viability_write ON case_viability USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
) WITH CHECK (
  decided_by = app_actor_id() AND actor_role() IN ('lawyer', 'admin', 'staff')
  AND can_read_case(case_id)
);

ALTER POLICY contracts_read ON contracts USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
);
ALTER POLICY contracts_insert ON contracts WITH CHECK (
  created_by = app_actor_id() AND actor_role() IN ('lawyer', 'admin', 'staff')
  AND can_read_case(case_id)
);
-- A transição pra 'sent'/'signed' continua só possível pela trilha de assinatura (0012/0024), que
-- agora também exige OAB confirmada (seção 4) — abrir esta política pra 'staff' não deixa 'staff'
-- assinar, só editar/cancelar um rascunho.
ALTER POLICY contracts_update ON contracts USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
) WITH CHECK (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id) AND status <> 'signed'
);

ALTER POLICY installments_read ON contract_installments USING (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_installments.contract_id
      AND actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(c.case_id)
  )
);
ALTER POLICY installments_write ON contract_installments USING (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_installments.contract_id
      AND actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(c.case_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_installments.contract_id
      AND actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(c.case_id)
  )
);

ALTER POLICY signatures_read ON contract_signatures USING (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_signatures.contract_id AND (
      (actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(c.case_id)) OR owns_case(c.case_id)
    )
  )
);

ALTER POLICY ai_summary_read ON case_ai_summaries USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
);
ALTER POLICY ai_summary_write ON case_ai_summaries USING (
  actor_role() IN ('lawyer', 'admin', 'staff') AND can_read_case(case_id)
) WITH CHECK (
  gerado_por = app_actor_id() AND actor_role() IN ('lawyer', 'admin', 'staff')
  AND can_read_case(case_id)
);

-- Excluir continua restrito a lawyer/admin — mais destrutivo que elaborar, não foi pedido pra
-- 'staff' (lawyer_case_delete, contracts_delete da migração 0017 ficam como estavam).

-- ------------------------------------------------------------------ 4) assinar exige OAB confirmada

-- signatures_insert_lawyer (0024): a assinatura do advogado responsável, ao enviar o contrato,
-- passa a exigir OAB confirmada — antes bastava actor_role() IN ('lawyer','admin'), e um admin
-- sem OAB nenhuma já podia assinar como responsável pelo caso.
ALTER POLICY signatures_insert_lawyer ON contract_signatures WITH CHECK (
  signer_role = 'lawyer' AND signed_by = app_actor_id() AND actor_oab_confirmada() AND EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_signatures.contract_id
      AND actor_role() IN ('lawyer', 'admin') AND can_read_case(c.case_id) AND c.status = 'draft'
  )
);

-- ------------------------------------------------------------------ 5) finalizar e assinar petição/peça

-- Não é a assinatura que vale para protocolar em juízo (isso continua sendo o certificado
-- ICP-Brasil do advogado ou o login do sistema do tribunal, fora desta plataforma) — é um
-- "assinar" interno: quem, no escritório, com OAB confirmada, autorizou esta versão como final.
-- Trava novas edições daquela linha (petitions_access, seção 3, já exige finalizado_em IS NULL
-- para UPDATE); uma correção depois disso é sempre "Gerar nova versão", nunca editar a assinada.
CREATE FUNCTION finalizar_peticao(p_petition_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; alvo case_petitions%ROWTYPE;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL OR NOT actor_oab_confirmada() THEN
    RAISE EXCEPTION 'só advogado com OAB confirmada pode assinar';
  END IF;
  SELECT * INTO alvo FROM case_petitions WHERE id = p_petition_id;
  IF alvo.id IS NULL OR NOT can_read_case(alvo.case_id) THEN
    RAISE EXCEPTION 'petição/peça não encontrada';
  END IF;
  IF alvo.finalizado_em IS NOT NULL THEN
    RETURN;
  END IF;
  UPDATE case_petitions SET finalizado_em = now(), finalizado_por = actor
  WHERE id = p_petition_id;
  INSERT INTO audit_logs(actor_id, case_id, action)
    VALUES (actor, alvo.case_id, 'finalizar_peticao:' || p_petition_id);
END $$;

-- ------------------------------------------------------------------ 6) cadastro direto de membro

-- Substitui convidar_membro_equipe para quem o admin cadastra direto (sem convite por e-mail): o
-- chamador (ver app/equipe/actions.ts) já criou a conta Neon Auth com e-mail/senha definidos pelo
-- próprio admin, ANTES de chamar esta função — por isso aqui é INSERT ... ON CONFLICT, não
-- UPDATE: a conta é nova e nunca passou por /equipe/layout.tsx (que é o que normalmente cria a
-- primeira linha em profiles, no primeiro login). O papel e (se advogado) a OAB são os que o
-- admin digitou, confirmados na hora por ele mesmo — mesmo padrão já usado em
-- aceitar_convite_equipe: quem adiciona se compromete, a plataforma não reconfere.
CREATE FUNCTION cadastrar_membro_equipe_direto(
  p_user_id text, p_email text, p_role text, p_cpf text, p_oab_numero text, p_oab_uf text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; actor_office uuid; ocupantes int; alvo_tem_escritorio boolean;
BEGIN
  actor := app_actor_id();
  SELECT office_id INTO actor_office FROM profiles WHERE user_id = actor AND role = 'admin';
  IF actor_office IS NULL THEN
    RAISE EXCEPTION 'apenas administradores do escritório cadastram membros';
  END IF;
  IF p_role NOT IN ('lawyer', 'staff') THEN
    RAISE EXCEPTION 'papel inválido';
  END IF;
  IF p_role = 'lawyer' AND (p_oab_numero IS NULL OR p_oab_uf IS NULL) THEN
    RAISE EXCEPTION 'cadastro de advogado exige OAB';
  END IF;
  SELECT (office_id IS NOT NULL) INTO alvo_tem_escritorio FROM profiles WHERE user_id = p_user_id;
  IF alvo_tem_escritorio THEN
    RAISE EXCEPTION 'esta conta já está em um escritório';
  END IF;
  SELECT count(*) INTO ocupantes FROM profiles WHERE office_id = actor_office AND role IN ('lawyer', 'staff');
  IF ocupantes >= 5 THEN
    RAISE EXCEPTION 'o escritório já tem 5 funcionários';
  END IF;
  INSERT INTO profiles(user_id, role, office_id, email, cpf, oab_numero, oab_uf, oab_verificado_em, oab_verificado_por)
    VALUES (p_user_id, p_role, actor_office, p_email, p_cpf,
      CASE WHEN p_role = 'lawyer' THEN p_oab_numero END,
      CASE WHEN p_role = 'lawyer' THEN upper(p_oab_uf) END,
      CASE WHEN p_role = 'lawyer' THEN now() END,
      CASE WHEN p_role = 'lawyer' THEN actor END)
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, office_id = EXCLUDED.office_id,
      email = EXCLUDED.email, cpf = EXCLUDED.cpf, oab_numero = EXCLUDED.oab_numero,
      oab_uf = EXCLUDED.oab_uf, oab_verificado_em = EXCLUDED.oab_verificado_em,
      oab_verificado_por = EXCLUDED.oab_verificado_por
    WHERE profiles.office_id IS NULL;
  INSERT INTO audit_logs(actor_id, action)
    VALUES (actor, 'cadastrar_membro_equipe_direto:' || p_user_id);
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION
      office_has_active_subscription(uuid), actor_oab_confirmada(), finalizar_peticao(uuid),
      cadastrar_membro_equipe_direto(text, text, text, text, text, text)
      TO juris_app;
  END IF;
END $$;
