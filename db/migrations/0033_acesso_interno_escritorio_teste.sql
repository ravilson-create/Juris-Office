-- Escritórios internos/de teste podem usar a área profissional sem cobrança Asaas.
-- A exceção é explícita e auditável no próprio escritório; clientes comerciais continuam
-- dependendo de uma assinatura ativa do administrador.

ALTER TABLE offices
  ADD COLUMN internal_access boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN offices.internal_access IS
  'Libera acesso profissional sem cobrança externa; reservado a escritórios internos/de teste.';

CREATE OR REPLACE FUNCTION office_has_active_subscription(p_office_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM offices o
    WHERE o.id = p_office_id
      AND (
        o.internal_access = true
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.office_id = o.id
            AND p.role = 'admin'
            AND has_active_subscription(p.user_id)
        )
      )
  )
$$;

-- Escritório padrão usado para testes reais do produto.
UPDATE offices
SET internal_access = true
WHERE id = '00000000-0000-4000-8000-000000000001';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT EXECUTE ON FUNCTION office_has_active_subscription(uuid) TO juris_app;
  END IF;
END $$;
