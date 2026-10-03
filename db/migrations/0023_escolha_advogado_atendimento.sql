-- Escolha de advogado pelo cliente, no fim do atendimento (opcional — ver app/atendimento/[caseId]
-- /advogado/page.tsx e CHANGELOG). Sem isso, o caso continua caindo no escritório padrão e um
-- admin atribui manualmente, como sempre funcionou; a diretoria de advogados (migração 0022)
-- sozinha não mudava nada no caso em si.
--
-- Gated por owns_case() (não app_actor_id()): quem está preenchendo o atendimento pode nunca ter
-- feito login — a sessão anônima do navegador é dona do caso tanto quanto uma conta — mesmo
-- padrão já usado pelas ações de salvar identificação/triagem/relato.
CREATE FUNCTION escolher_advogado_atendimento(p_case_id uuid, p_lawyer_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  area_do_caso uuid;
  status_do_caso text;
  office_do_advogado uuid;
BEGIN
  IF NOT owns_case(p_case_id) THEN
    RAISE EXCEPTION 'atendimento não encontrado ou sem permissão';
  END IF;
  SELECT legal_area_id, status INTO area_do_caso, status_do_caso
  FROM legal_cases WHERE id = p_case_id;
  IF status_do_caso <> 'ready_for_review' THEN
    RAISE EXCEPTION 'este atendimento não está pronto para escolher advogado';
  END IF;

  -- Revalida tudo de novo contra o banco — o formulário pode mostrar uma lista desatualizada
  -- (ex.: advogado perdeu a assinatura entre a tela carregar e o clique), nunca confia só no que
  -- veio do cliente.
  SELECT p.office_id INTO office_do_advogado
  FROM profiles p
  JOIN lawyer_areas la ON la.lawyer_id = p.user_id AND la.legal_area_id = area_do_caso
  WHERE p.user_id = p_lawyer_id AND p.role = 'lawyer' AND p.oab_verificado_em IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM lawyer_subscriptions s
      WHERE s.lawyer_id = p.user_id AND s.status IN ('active', 'trial') AND s.valid_until > now()
    );
  IF office_do_advogado IS NULL THEN
    RAISE EXCEPTION 'advogado indisponível para esta área';
  END IF;

  UPDATE legal_cases SET office_id = office_do_advogado, updated_at = now() WHERE id = p_case_id;
  -- Troca de ideia antes de finalizar: substitui a escolha anterior em vez de acumular.
  DELETE FROM case_assignments WHERE case_id = p_case_id;
  INSERT INTO case_assignments(case_id, lawyer_id, office_id)
    VALUES (p_case_id, p_lawyer_id, office_do_advogado);
  INSERT INTO audit_logs(actor_id, case_id, action)
    VALUES (coalesce(app_actor_id(), 'cidadao_anonimo'), p_case_id, 'escolher_advogado_atendimento:' || p_lawyer_id);
END $$;

-- Lido pela revisão e pela própria tela de escolha, para saber se já há alguém escolhido —
-- também gated por owns_case(), nunca por can_read_case() (essa é a leitura do lado profissional).
CREATE FUNCTION advogado_escolhido_atendimento(p_case_id uuid)
RETURNS TABLE(lawyer_id text, escritorio text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT a.lawyer_id, o.name
  FROM case_assignments a JOIN offices o ON o.id = a.office_id
  WHERE a.case_id = p_case_id AND owns_case(p_case_id)
  LIMIT 1
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION
      escolher_advogado_atendimento(uuid, text),
      advogado_escolhido_atendimento(uuid)
      TO juris_app;
  END IF;
END $$;
