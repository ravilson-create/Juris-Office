-- Viabilidade da causa, contrato e parcelas de honorários (Portal do Advogado, PR4 — ativa o
-- módulo F2, antes só tipos em domain/contract/schema.ts). Sem emissão de nota fiscal nem
-- cobrança automática nesta PR; "signed" (aceite eletrônico com trilha) é a PR5.

-- Uma decisão de viabilidade por caso (PK é o próprio case_id): decidir de novo substitui a
-- anterior, nunca acumula histórico de decisões divergentes sobre o mesmo caso.
CREATE TABLE case_viability (
  case_id uuid PRIMARY KEY REFERENCES legal_cases(id) ON DELETE CASCADE,
  feasibility_note text NOT NULL CHECK (length(trim(feasibility_note)) BETWEEN 1 AND 4000),
  risk text NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  decision text NOT NULL CHECK (decision IN ('accepted', 'rejected', 'needs_info')),
  decided_by text NOT NULL REFERENCES profiles(user_id),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE case_viability ENABLE ROW LEVEL SECURITY;
CREATE POLICY viability_read ON case_viability FOR SELECT USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);
CREATE POLICY viability_write ON case_viability FOR ALL USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
) WITH CHECK (
  decided_by = app_actor_id() AND actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);

-- A RLS de legal_cases (migração 0003) só previa UPDATE pelo cidadão dono. A decisão de
-- viabilidade também atualiza o status do caso (ver statusCasoParaDecisao) — por isso
-- advogado/admin com acesso ao caso precisam da mesma permissão.
CREATE POLICY lawyer_case_status_update ON legal_cases FOR UPDATE USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(id)
);

CREATE TABLE contracts (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  fee_type text NOT NULL CHECK (fee_type IN ('fixed', 'success', 'hourly', 'mixed')),
  fee_value_cents bigint NOT NULL CHECK (fee_value_cents >= 0),
  success_percentage numeric(5, 2)
    CHECK (success_percentage IS NULL OR success_percentage BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'cancelled')),
  signed_at timestamptz,
  signature_hash text,
  created_by text NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contracts_case_idx ON contracts(case_id, created_at DESC);
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contracts_read ON contracts FOR SELECT USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);
CREATE POLICY contracts_insert ON contracts FOR INSERT WITH CHECK (
  created_by = app_actor_id() AND actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);
CREATE POLICY contracts_update ON contracts FOR UPDATE USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
);

CREATE TABLE contract_installments (
  id uuid PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue'))
);
CREATE INDEX installments_contract_idx ON contract_installments(contract_id, due_date);
ALTER TABLE contract_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY installments_read ON contract_installments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_installments.contract_id
      AND actor_role() IN ('lawyer', 'admin') AND can_read_case(c.case_id)
  )
);
CREATE POLICY installments_write ON contract_installments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_installments.contract_id
      AND actor_role() IN ('lawyer', 'admin') AND can_read_case(c.case_id)
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_installments.contract_id
      AND actor_role() IN ('lawyer', 'admin') AND can_read_case(c.case_id)
  )
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE ON case_viability TO juris_app;
    GRANT SELECT, INSERT, UPDATE ON contracts TO juris_app;
    GRANT SELECT, INSERT, UPDATE ON contract_installments TO juris_app;
  END IF;
END $$;
