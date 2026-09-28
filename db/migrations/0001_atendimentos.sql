-- Júris Office IA — esquema inicial dos atendimentos (fase F5, Neon/PostgreSQL).
-- Catálogos (áreas jurídicas, perguntas de triagem, checklists) continuam no código:
-- aqui ficam apenas os dados dos atendimentos. Todos os identificadores são UUID.
-- Datas e horas em timestamptz (UTC); datas civis dos fatos ficam dentro do JSON das respostas.

CREATE TABLE legal_cases (
  id                 uuid PRIMARY KEY,
  protocol           text        NOT NULL,
  legal_area_id      uuid        NOT NULL,
  owner_session_hash text        CHECK (owner_session_hash ~ '^[a-f0-9]{64}$'),
  citizen_id         uuid,
  status             text        NOT NULL CHECK (status IN (
    'draft','triage','awaiting_documents','ready_for_review','submitted',
    'under_legal_review','needs_information','accepted','rejected',
    'in_negotiation','active','closed')),
  title              text,
  applicant          jsonb,
  narrative          text,
  consent_accepted   boolean     NOT NULL DEFAULT false,
  consent_accepted_at timestamptz,
  revision           integer     NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL,
  submitted_at       timestamptz,
  -- Coerência da finalização: status "submitted" exige data de finalização e,
  -- havendo data de finalização, o caso não pode voltar a um status editável.
  CONSTRAINT submitted_has_date CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),
  CONSTRAINT submitted_not_editable CHECK (
    submitted_at IS NULL OR status NOT IN ('draft','triage','awaiting_documents','ready_for_review'))
);
-- Protocolo único: o sufixo aleatório reduz colisões; a restrição garante.
CREATE UNIQUE INDEX legal_cases_protocol_key ON legal_cases (protocol);
CREATE INDEX legal_cases_owner_idx ON legal_cases (owner_session_hash, updated_at DESC);

CREATE TABLE triage_answers (
  case_id      uuid        NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  question_key text        NOT NULL,
  id           uuid        NOT NULL,
  question_id  uuid        NOT NULL,
  value        jsonb       NOT NULL,
  created_at   timestamptz NOT NULL,
  updated_at   timestamptz NOT NULL,
  PRIMARY KEY (case_id, question_key)
);

CREATE TABLE case_documents (
  id            uuid PRIMARY KEY,
  case_id       uuid        NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  category      text        NOT NULL,
  original_name text        NOT NULL,
  storage_path  text,
  mime_type     text,
  size          integer     CHECK (size IS NULL OR size >= 0),
  status        text        NOT NULL CHECK (status IN ('pending','uploaded','rejected')),
  created_at    timestamptz NOT NULL
);
CREATE INDEX case_documents_case_idx ON case_documents (case_id, created_at);

CREATE TABLE dossiers (
  id         uuid PRIMARY KEY,
  case_id    uuid        NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  version    integer     NOT NULL CHECK (version > 0),
  payload    jsonb       NOT NULL,
  created_at timestamptz NOT NULL,
  -- Nunca dois dossiês com a mesma versão para o mesmo caso.
  CONSTRAINT dossiers_case_version_key UNIQUE (case_id, version)
);

CREATE TABLE case_drafts (
  case_id   uuid        NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  scope     text        NOT NULL,
  draft_values jsonb    NOT NULL,
  form_key  uuid        NOT NULL,
  seq       integer     NOT NULL CHECK (seq >= 0),
  base_time timestamptz NOT NULL,
  saved_at  timestamptz NOT NULL,
  PRIMARY KEY (case_id, scope)
);

-- Instante da última gravação oficial de cada parte (barra rascunhos atrasados).
CREATE TABLE case_draft_commits (
  case_id      uuid        NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  scope        text        NOT NULL,
  committed_at timestamptz NOT NULL,
  PRIMARY KEY (case_id, scope)
);
