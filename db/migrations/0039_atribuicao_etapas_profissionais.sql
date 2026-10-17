-- A fila permite atribuir em qualquer etapa profissional, mas a política antiga
-- aceitava apenas 'submitted': abrir a análise já impedia atribuições posteriores.
ALTER POLICY assignment_admin_insert ON case_assignments WITH CHECK (
  actor_role() = 'admin'
  AND actor_office_id() = case_assignments.office_id
  AND office_has_active_subscription(case_assignments.office_id)
  AND EXISTS (
    SELECT 1 FROM profiles lawyer
    WHERE lawyer.user_id = case_assignments.lawyer_id
      AND lawyer.role = 'lawyer'
      AND lawyer.office_id = case_assignments.office_id
      AND lawyer.oab_verificado_em IS NOT NULL
  )
  AND EXISTS (
    SELECT 1 FROM legal_cases c
    WHERE c.id = case_assignments.case_id
      AND c.office_id = case_assignments.office_id
      AND c.status IN ('submitted','under_legal_review','needs_information','accepted',
        'rejected','in_negotiation','active','closed')
  )
);
