-- Peças mais usadas no rito da CLT (manifestação sobre a defesa, recurso ordinário e
-- contrarrazões, execução/cálculos e agravo de petição) — embargos de declaração e as demais
-- peças genéricas (migração 0025) já servem qualquer área, inclusive trabalhista, sem mudança.
--
-- A CHECK de case_petitions.tipo precisa ser recriada (não dá para só "adicionar um valor" a uma
-- CHECK existente) — nome da constraint é o padrão que o Postgres gera para uma CHECK de coluna
-- sem nome explícito (<tabela>_<coluna>_check).
ALTER TABLE case_petitions DROP CONSTRAINT case_petitions_tipo_check;
ALTER TABLE case_petitions ADD CONSTRAINT case_petitions_tipo_check CHECK (
  tipo IN (
    'peticao_inicial', 'replica', 'agravo_tutela', 'embargos_declaracao', 'apelacao',
    'contrarrazoes_apelacao', 'cumprimento_sentenca', 'pedido_multa', 'homologacao_acordo',
    'manifestacao_defesa', 'recurso_ordinario', 'contrarrazoes_recurso_ordinario',
    'cumprimento_execucao_trabalhista', 'impugnacao_calculos', 'agravo_peticao'
  )
);
