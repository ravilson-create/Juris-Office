-- Peças pós-decisão (réplica, agravo de instrumento contra tutela, embargos de declaração,
-- apelação, contrarrazões de apelação, cumprimento de sentença, pedido de multa e homologação
-- de acordo) e limite mensal de auxílio da IA na elaboração de qualquer peça (petição inicial
-- inclusive).
--
-- `case_petitions` já servia qualquer documento com seções/pendências/revisão por IA (migração
-- 0009) — a petição inicial é só o primeiro `tipo`. RLS, GRANT, rota de .docx/.pdf e o editor de
-- seção por seção continuam os mesmos, sem nenhuma mudança: todos já trabalham por `id`, nunca
-- por tipo.
ALTER TABLE case_petitions ADD COLUMN tipo text NOT NULL DEFAULT 'peticao_inicial' CHECK (
  tipo IN (
    'peticao_inicial', 'replica', 'agravo_tutela', 'embargos_declaracao', 'apelacao',
    'contrarrazoes_apelacao', 'cumprimento_sentenca', 'pedido_multa', 'homologacao_acordo'
  )
);

-- Contador mensal de auxílio da IA por advogado (a mesma conta que assina — não por escritório,
-- já que a assinatura em si também é por advogado, não por escritório). Uma linha por
-- (advogado, mês) — "mês" como texto 'AAAA-MM' porque não precisa de aritmética de data, só
-- igualdade. Cada chamada de corrigirSecaoIAAction (petição inicial ou qualquer peça nova) passa
-- por consumir_auxilio_ia() antes de gerar a sugestão; nenhuma linha é lida nem escrita por SQL
-- direto do app, só pelas duas funções abaixo.
CREATE TABLE ai_drafting_usage (
  lawyer_id text NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  periodo text NOT NULL CHECK (periodo ~ '^\d{4}-\d{2}$'),
  contador integer NOT NULL DEFAULT 0 CHECK (contador >= 0),
  PRIMARY KEY (lawyer_id, periodo)
);
ALTER TABLE ai_drafting_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_self ON ai_drafting_usage FOR SELECT USING (lawyer_id = app_actor_id());

-- Atômica: upsert da linha do mês + trava de linha (FOR UPDATE) + checagem do limite + incremento
-- na mesma função, para duas chamadas concorrentes do mesmo advogado nunca passarem do limite.
-- Devolve false (sem incrementar) quando o limite já foi atingido.
CREATE FUNCTION consumir_auxilio_ia() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  actor text;
  periodo_atual text;
  usados integer;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RETURN false;
  END IF;
  periodo_atual := to_char(now(), 'YYYY-MM');
  INSERT INTO ai_drafting_usage(lawyer_id, periodo, contador) VALUES (actor, periodo_atual, 0)
    ON CONFLICT (lawyer_id, periodo) DO NOTHING;
  SELECT contador INTO usados FROM ai_drafting_usage
    WHERE lawyer_id = actor AND periodo = periodo_atual FOR UPDATE;
  IF usados >= 50 THEN
    RETURN false;
  END IF;
  UPDATE ai_drafting_usage SET contador = contador + 1
    WHERE lawyer_id = actor AND periodo = periodo_atual;
  RETURN true;
END $$;

-- Só para mostrar "restam X de 50" na tela, sem gastar a cota.
CREATE FUNCTION auxilios_ia_restantes() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; usados integer;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RETURN 0;
  END IF;
  SELECT contador INTO usados FROM ai_drafting_usage
    WHERE lawyer_id = actor AND periodo = to_char(now(), 'YYYY-MM');
  RETURN 50 - coalesce(usados, 0);
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'juris_app') THEN
    GRANT SELECT ON ai_drafting_usage TO juris_app;
    GRANT EXECUTE ON FUNCTION consumir_auxilio_ia(), auxilios_ia_restantes() TO juris_app;
  END IF;
END $$;
