-- Auditoria de leitura (Portal do Advogado, PR6). audit_logs existe desde a 0003, mas só com
-- política de INSERT — ninguém conseguia ler a própria trilha, nem um admin a do escritório
-- (RLS nega por padrão sem política de SELECT). Esta migração:
--   1. acrescenta a política de leitura que faltava;
--   2. passa a registrar também o acesso de advogado/admin a um caso (não só ações que mudam
--      dado), para a rastreabilidade de quem viu o quê — é o que falta para o art. 117 da Lei
--      14.133 (dar lastro a quem teve acesso a informação sensível do processo).

-- Cada ator vê a própria trilha (transparência); admin vê também a de todo caso do seu
-- escritório. Entradas sem case_id (ex.: claim_legacy_case) só aparecem para o próprio ator.
CREATE POLICY audit_read ON audit_logs FOR SELECT USING (
  actor_id = app_actor_id()
  OR (actor_role() = 'admin' AND case_id IS NOT NULL AND can_read_case(case_id))
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT ON audit_logs TO juris_app;
  END IF;
END $$;
