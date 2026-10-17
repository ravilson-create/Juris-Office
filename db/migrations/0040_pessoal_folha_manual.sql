-- Gestão interna de pessoal e folha; nenhum pagamento, emissão fiscal ou eSocial.
CREATE TABLE office_employees (
  id uuid PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES offices(id),
  created_by text NOT NULL REFERENCES profiles(user_id),
  full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 3 AND 160),
  cpf text CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  job_title text NOT NULL CHECK (length(trim(job_title)) BETWEEN 2 AND 120),
  employment_kind text NOT NULL CHECK (employment_kind IN ('clt','estagio','associado','prestador','outro')),
  hired_on date NOT NULL,
  monthly_salary_cents bigint NOT NULL CHECK (monthly_salary_cents BETWEEN 0 AND 100000000000),
  weekly_hours numeric(5,2) NOT NULL CHECK (weekly_hours BETWEEN 0 AND 60),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','afastado','desligado')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, office_id)
);
CREATE INDEX office_employees_by_office ON office_employees(office_id,full_name);
CREATE UNIQUE INDEX office_employees_cpf_office ON office_employees(office_id,cpf) WHERE cpf IS NOT NULL;

CREATE TABLE office_payroll (
  id uuid PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES offices(id),
  employee_id uuid NOT NULL,
  created_by text NOT NULL REFERENCES profiles(user_id),
  period date NOT NULL CHECK (extract(day FROM period) = 1),
  kind text NOT NULL CHECK (kind IN ('mensal','decimo_terceiro','ferias','rescisao')),
  base_cents bigint NOT NULL CHECK (base_cents BETWEEN 0 AND 100000000000),
  additions_cents bigint NOT NULL DEFAULT 0 CHECK (additions_cents BETWEEN 0 AND 100000000000),
  deductions_cents bigint NOT NULL DEFAULT 0 CHECK (deductions_cents BETWEEN 0 AND 100000000000),
  employer_charges_cents bigint NOT NULL DEFAULT 0 CHECK (employer_charges_cents BETWEEN 0 AND 100000000000),
  benefits_cents bigint NOT NULL DEFAULT 0 CHECK (benefits_cents BETWEEN 0 AND 100000000000),
  due_on date NOT NULL,
  paid_on date CHECK (paid_on IS NULL OR paid_on <= (now() AT TIME ZONE 'America/Sao_Paulo')::date),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','fechada')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (employee_id,office_id) REFERENCES office_employees(id,office_id),
  UNIQUE(employee_id,period,kind),
  CHECK (base_cents + additions_cents > 0 AND deductions_cents <= base_cents + additions_cents),
  CHECK (paid_on IS NULL OR status = 'fechada')
);
CREATE INDEX office_payroll_by_office_period ON office_payroll(office_id,period DESC);

CREATE TABLE office_employee_events (
  id uuid PRIMARY KEY,
  office_id uuid NOT NULL REFERENCES offices(id),
  employee_id uuid NOT NULL,
  created_by text NOT NULL REFERENCES profiles(user_id),
  kind text NOT NULL CHECK (kind IN ('ferias','falta','afastamento','licenca')),
  starts_on date NOT NULL, ends_on date NOT NULL CHECK (ends_on >= starts_on),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (employee_id,office_id) REFERENCES office_employees(id,office_id)
);
CREATE INDEX office_employee_events_office ON office_employee_events(office_id,starts_on DESC);

-- Tanto o backend quanto a política do banco exigem administrador do escritório.
CREATE FUNCTION personnel_access(p_office uuid) RETURNS boolean LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public,pg_temp AS $$
  SELECT app_actor_id() IS NOT NULL AND actor_role() = 'admin'
    AND actor_office_id() = p_office AND office_has_active_subscription(p_office)
$$;
ALTER TABLE office_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_employee_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY office_employees_admin ON office_employees FOR ALL
  USING (personnel_access(office_id)) WITH CHECK (personnel_access(office_id));
CREATE POLICY office_payroll_admin ON office_payroll FOR ALL
  USING (personnel_access(office_id)) WITH CHECK (personnel_access(office_id));
CREATE POLICY office_events_admin ON office_employee_events FOR ALL
  USING (personnel_access(office_id)) WITH CHECK (personnel_access(office_id));

-- Folhas fechadas são imutáveis salvo registro único de data do pagamento.
CREATE FUNCTION office_payroll_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = public,pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'fechada' THEN
    IF OLD.paid_on IS NOT NULL OR NEW.paid_on IS NULL
      OR (to_jsonb(NEW) - 'paid_on' - 'updated_at')
         IS DISTINCT FROM (to_jsonb(OLD) - 'paid_on' - 'updated_at') THEN
      RAISE EXCEPTION 'folha fechada: apenas registrar pagamento ainda pendente';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'rascunho' AND OLD.paid_on IS NOT NULL THEN
    RAISE EXCEPTION 'folha inconsistente';
  END IF;
  INSERT INTO audit_logs(actor_id,action)
  VALUES (app_actor_id(), 'office_payroll:' || TG_OP || ':' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER office_payroll_guard BEFORE INSERT OR UPDATE ON office_payroll
FOR EACH ROW EXECUTE FUNCTION office_payroll_guard();
CREATE FUNCTION office_employee_audit() RETURNS trigger LANGUAGE plpgsql
SET search_path = public,pg_temp AS $$
BEGIN
  INSERT INTO audit_logs(actor_id,action) VALUES
    (app_actor_id(), TG_TABLE_NAME || ':' || TG_OP || ':' || NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER office_employees_audit BEFORE INSERT OR UPDATE ON office_employees
FOR EACH ROW EXECUTE FUNCTION office_employee_audit();
CREATE TRIGGER office_events_audit BEFORE INSERT ON office_employee_events
FOR EACH ROW EXECUTE FUNCTION office_employee_audit();

REVOKE ALL ON FUNCTION office_payroll_guard(),office_employee_audit() FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='juris_app') THEN
   GRANT SELECT,INSERT,UPDATE ON office_employees,office_payroll TO juris_app;
   GRANT SELECT,INSERT ON office_employee_events TO juris_app;
   GRANT EXECUTE ON FUNCTION personnel_access(uuid) TO juris_app;
 END IF;
END $$;