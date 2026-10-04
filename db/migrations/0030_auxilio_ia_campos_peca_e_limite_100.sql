-- Eleva o limite mensal de auxílio da IA de 50 para 100 por advogado (mesma cota única,
-- compartilhada entre a correção de redação de seções e, a partir desta migração, o auxílio de
-- IA para preenchimento dos campos livres do formulário de peças — ver lib/ai/auxiliar-campo-
-- peca.ts). Mantém a mesma lógica atômica (upsert + FOR UPDATE + incremento) das funções
-- originais (migração 0025), só troca a constante do limite.
CREATE OR REPLACE FUNCTION consumir_auxilio_ia() RETURNS boolean
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
  IF usados >= 100 THEN
    RETURN false;
  END IF;
  UPDATE ai_drafting_usage SET contador = contador + 1
    WHERE lawyer_id = actor AND periodo = periodo_atual;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION auxilios_ia_restantes() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor text; usados integer;
BEGIN
  actor := app_actor_id();
  IF actor IS NULL THEN
    RETURN 0;
  END IF;
  SELECT contador INTO usados FROM ai_drafting_usage
    WHERE lawyer_id = actor AND periodo = to_char(now(), 'YYYY-MM');
  RETURN 100 - coalesce(usados, 0);
END $$;
