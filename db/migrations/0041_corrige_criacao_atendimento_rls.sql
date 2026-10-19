-- Permite ler a própria linha sem uma segunda SELECT à mesma tabela durante
-- INSERT ... RETURNING. As funções STABLE can_read_case/owns_case consultam legal_cases
-- por ID e, em uma inserção, podem não enxergar a linha até terminar o statement.
-- Manter a regra anterior de acesso de profissionais sem permitir acesso entre cidadãos.
DROP POLICY IF EXISTS citizen_case_select ON legal_cases;
CREATE POLICY citizen_case_select ON legal_cases FOR SELECT USING (
  (app_actor_id() IS NOT NULL AND citizen_id = app_actor_id())
  OR (app_anon_hash() IS NOT NULL AND owner_session_hash = app_anon_hash())
  OR can_read_case(id)
);
