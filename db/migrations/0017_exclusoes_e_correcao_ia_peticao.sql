-- Exclusão de atendimento, contrato e petição, e segunda peça da F3 (correção de petição por
-- IA, seção a seção). Nenhuma das três tabelas tinha política nem GRANT de DELETE até aqui — só
-- case_petitions já tinha os dois (migração 0009), sem uso em código ainda.

-- Atendimento: só antes de aceito/em negociação/ativo/encerrado — nesses status já costuma
-- existir contrato, e apagar o caso cascateia e apaga o contrato junto (migração 0011). Tanto o
-- cidadão dono (owns_case cobre login e sessão anônima, migração 0007) quanto advogado/admin com
-- acesso podem excluir, desde que o status permita.
CREATE POLICY citizen_case_delete ON legal_cases FOR DELETE USING (
  owns_case(id) AND status NOT IN ('accepted', 'in_negotiation', 'active', 'closed')
);
CREATE POLICY lawyer_case_delete ON legal_cases FOR DELETE USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(id)
  AND status NOT IN ('accepted', 'in_negotiation', 'active', 'closed')
);

-- Contrato: só rascunho ou cancelado — nunca enviado ou assinado, preservando a evidência do
-- acordo de honorários já formalizado com o cliente (mesma lógica que já impede a transição de
-- status de um contrato "signed", em domain/contract/status.ts).
CREATE POLICY contracts_delete ON contracts FOR DELETE USING (
  actor_role() IN ('lawyer', 'admin') AND can_read_case(case_id)
  AND status IN ('draft', 'cancelled')
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT DELETE ON legal_cases TO juris_app;
    GRANT DELETE ON contracts TO juris_app;
  END IF;
END $$;

-- Marca quais seções de uma petição foram revisadas e aceitas a partir de uma sugestão da IA
-- (F3, segunda peça) — nunca aplicada sozinha, só quando o advogado clica em "Usar esta versão"
-- por seção. case_petitions já tinha DELETE concedido (migração 0009); esta coluna só acrescenta
-- o rastro de IA exigido pelo plano mestre ("marcada como assistida por IA").
ALTER TABLE case_petitions ADD COLUMN secoes_revisadas_ia jsonb NOT NULL DEFAULT '[]'::jsonb;
