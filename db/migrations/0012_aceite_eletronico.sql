-- Aceite eletrônico de contrato, com trilha de auditoria (Portal do Advogado, PR5 — a peça que
-- faltava desde a PR4, quando "signed" foi deixado de propósito inalcançável).
--
-- Quem assina é o cliente (cidadão dono do caso), não o advogado: um contrato "sent" passa a
-- "signed" só por essa trilha, nunca por uma atualização direta de status. signed_by/
-- signed_by_hash espelham o mesmo modelo dual de dono de caso da 0007 (owns_case): conta logada
-- quando houver, senão o hash da sessão anônima do navegador — entrar na conta nunca é exigido
-- para assinar.

CREATE TABLE contract_signatures (
  id uuid PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signed_by text,
  signed_by_hash text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip text NOT NULL,
  user_agent text NOT NULL,
  signature_hash text NOT NULL,
  CHECK (signed_by IS NOT NULL OR signed_by_hash IS NOT NULL)
);
CREATE INDEX contract_signatures_contract_idx ON contract_signatures(contract_id);
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY signatures_read ON contract_signatures FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_signatures.contract_id AND (
      (actor_role() IN ('lawyer', 'admin') AND can_read_case(c.case_id)) OR owns_case(c.case_id)
    )
  )
);
-- Só o próprio cliente grava a assinatura, e só enquanto o contrato ainda está 'sent' — depois
-- de assinado uma vez, novo contrato é a única forma de renegociar.
CREATE POLICY signatures_insert ON contract_signatures FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_signatures.contract_id
      AND owns_case(c.case_id) AND c.status = 'sent'
  )
);

-- O cliente passa a ver o próprio contrato assim que o advogado o enviar (nunca em 'draft',
-- que é rascunho interno do escritório) e pode levá-lo a 'signed' — mas não para mais nada.
CREATE POLICY contracts_citizen_read ON contracts FOR SELECT USING (
  owns_case(case_id) AND status <> 'draft'
);
CREATE POLICY contracts_citizen_sign ON contracts FOR UPDATE USING (
  owns_case(case_id) AND status = 'sent'
) WITH CHECK (
  owns_case(case_id) AND status = 'signed'
);

-- contracts_update (0011) deixava qualquer mudança de status para advogado/admin, inclusive para
-- 'signed' direto — o que pularia a trilha de auditoria acima. Agora isso só acontece por ela.
ALTER POLICY contracts_update ON contracts WITH CHECK (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id) AND status <> 'signed'
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT ON contract_signatures TO juris_app;
  END IF;
END $$;
