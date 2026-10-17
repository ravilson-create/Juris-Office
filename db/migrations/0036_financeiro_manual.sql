-- Registros internos independentes das assinaturas da plataforma.
CREATE TABLE financial_entries (
  id uuid PRIMARY KEY, office_id uuid NOT NULL REFERENCES offices(id),
  created_by text NOT NULL REFERENCES profiles(user_id), request_id uuid NOT NULL,
  installment_number integer NOT NULL CHECK (installment_number BETWEEN 1 AND 120),
  installment_count integer NOT NULL CHECK (installment_count BETWEEN 1 AND 120 AND installment_number <= installment_count),
  case_id uuid REFERENCES legal_cases(id) ON DELETE RESTRICT,
  source_installment_id uuid UNIQUE REFERENCES contract_installments(id) ON DELETE RESTRICT,
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 2 AND 240),
  counterparty text NOT NULL CHECK (length(trim(counterparty)) BETWEEN 2 AND 160),
  kind text NOT NULL CHECK (kind IN ('honorarios','receita','despesa','repasse','acerto')),
  direction text NOT NULL CHECK (direction IN ('receber','pagar')),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000000),
  due_date date NOT NULL, notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  cancelled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (office_id, created_by, request_id, installment_number),
  CHECK (kind <> 'honorarios' OR direction = 'receber'),
  CHECK (kind NOT IN ('despesa','repasse') OR direction = 'pagar')
);
CREATE INDEX financial_entries_office_due ON financial_entries(office_id, due_date, id);
CREATE INDEX financial_entries_case ON financial_entries(case_id);
CREATE TABLE financial_settlements (
  id uuid PRIMARY KEY, entry_id uuid NOT NULL REFERENCES financial_entries(id) ON DELETE RESTRICT,
  created_by text NOT NULL REFERENCES profiles(user_id),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000000),
  paid_on date NOT NULL CHECK (paid_on <= (now() AT TIME ZONE 'America/Sao_Paulo')::date),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX financial_settlements_entry ON financial_settlements(entry_id);
CREATE INDEX financial_settlements_paid ON financial_settlements(paid_on);
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_settlements ENABLE ROW LEVEL SECURITY;

-- SECURITY INVOKER: só compõe verificações do modelo existente; não ignora RLS.
CREATE FUNCTION financial_access(p_office uuid, p_case uuid, p_creator text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT app_actor_id() IS NOT NULL AND p_office = actor_office_id()
    AND office_has_active_subscription(p_office)
    AND (actor_role() IN ('admin','staff') OR (actor_role() = 'lawyer' AND
      ((p_case IS NULL AND p_creator = app_actor_id()) OR (p_case IS NOT NULL AND can_read_case(p_case)))))
$$;
CREATE POLICY financial_read ON financial_entries FOR SELECT USING (financial_access(office_id, case_id, created_by));
CREATE POLICY financial_insert ON financial_entries FOR INSERT WITH CHECK (
  financial_access(office_id, case_id, created_by) AND created_by = app_actor_id()
  AND (case_id IS NULL OR EXISTS (SELECT 1 FROM legal_cases c
    WHERE c.id = case_id AND c.office_id = financial_entries.office_id AND can_read_case(c.id)))
);
-- UPDATE permite o lock de linha em baixas. O trigger abaixo só admite cancelamento autorizado.
CREATE POLICY financial_update ON financial_entries FOR UPDATE
  USING (financial_access(office_id, case_id, created_by))
  WITH CHECK (financial_access(office_id, case_id, created_by));
CREATE POLICY settlements_read ON financial_settlements FOR SELECT USING (
  app_actor_id() IS NOT NULL AND actor_role() IN ('admin','lawyer','staff')
  AND EXISTS (SELECT 1 FROM financial_entries e WHERE e.id = entry_id
    AND e.office_id = actor_office_id() AND office_has_active_subscription(e.office_id)
    AND financial_access(e.office_id, e.case_id, e.created_by))
);
CREATE POLICY settlements_insert ON financial_settlements FOR INSERT WITH CHECK (
  created_by = app_actor_id() AND actor_role() IN ('admin','lawyer','staff')
  AND EXISTS (SELECT 1 FROM financial_entries e WHERE e.id = entry_id AND NOT e.cancelled
    AND e.office_id = actor_office_id() AND office_has_active_subscription(e.office_id)
    AND financial_access(e.office_id, e.case_id, e.created_by))
);

CREATE FUNCTION financial_entry_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF actor_role() <> 'admin' AND NOT (actor_role() = 'lawyer' AND OLD.created_by = app_actor_id()) THEN
      RAISE EXCEPTION 'perfil não permite cancelar';
    END IF;
    IF (to_jsonb(NEW) - 'cancelled') IS DISTINCT FROM (to_jsonb(OLD) - 'cancelled')
       OR OLD.cancelled OR NOT NEW.cancelled THEN
      RAISE EXCEPTION 'registro imutável; cancele e registre a correção';
    END IF;
    IF EXISTS (SELECT 1 FROM financial_settlements WHERE entry_id = OLD.id) THEN
      RAISE EXCEPTION 'registro com baixa não pode ser cancelado';
    END IF;
  ELSIF NEW.source_installment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM contract_installments i JOIN contracts c ON c.id = i.contract_id
    JOIN legal_cases lc ON lc.id = c.case_id
    WHERE i.id = NEW.source_installment_id AND c.case_id = NEW.case_id
      AND lc.office_id = NEW.office_id AND i.status <> 'paid' AND c.status <> 'cancelled'
      AND i.amount_cents = NEW.amount_cents AND i.due_date = NEW.due_date
      AND NEW.kind = 'honorarios' AND NEW.direction = 'receber'
  ) THEN RAISE EXCEPTION 'parcela incompatível ou já paga';
  END IF;
  INSERT INTO audit_logs(actor_id, case_id, action)
    VALUES (app_actor_id(), NEW.case_id, 'financial_entry:' || TG_OP || ':' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER financial_entry_guard BEFORE INSERT OR UPDATE ON financial_entries
FOR EACH ROW EXECUTE FUNCTION financial_entry_guard();

CREATE FUNCTION financial_settlement_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE entry financial_entries%ROWTYPE; paid bigint;
BEGIN
  -- Lock real da conta: serializa baixas parciais e cancelamentos concorrentes.
  SELECT * INTO entry FROM financial_entries WHERE id = NEW.entry_id FOR UPDATE;
  IF entry.id IS NULL OR entry.cancelled THEN RAISE EXCEPTION 'registro indisponível'; END IF;
  SELECT coalesce(sum(amount_cents),0) INTO paid FROM financial_settlements WHERE entry_id = NEW.entry_id;
  IF paid + NEW.amount_cents > entry.amount_cents THEN RAISE EXCEPTION 'baixa excede saldo'; END IF;
  INSERT INTO audit_logs(actor_id, case_id, action)
    VALUES (app_actor_id(), entry.case_id, 'financial_settlement:' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER financial_settlement_guard BEFORE INSERT ON financial_settlements
FOR EACH ROW EXECUTE FUNCTION financial_settlement_guard();
REVOKE ALL ON FUNCTION financial_entry_guard(), financial_settlement_guard() FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT, INSERT, UPDATE ON financial_entries TO juris_app;
    GRANT SELECT, INSERT ON financial_settlements TO juris_app;
    GRANT EXECUTE ON FUNCTION financial_access(uuid, uuid, text) TO juris_app;
  END IF;
END $$;
