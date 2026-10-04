-- Peças de execução de alimentos (família) — rito próprio do art. 528 do CPC, com risco de
-- prisão civil, bem diferente do cumprimento de sentença comum (migração 0025). As demais peças
-- já informadas para família (réplica, embargos, tutela de urgência, apelação, contrarrazões,
-- homologação de acordo) já eram genéricas e já valiam para a área — nenhuma mudança nelas.
ALTER TABLE case_petitions DROP CONSTRAINT case_petitions_tipo_check;
ALTER TABLE case_petitions ADD CONSTRAINT case_petitions_tipo_check CHECK (
  tipo IN (
    'peticao_inicial', 'replica', 'agravo_tutela', 'embargos_declaracao', 'apelacao',
    'contrarrazoes_apelacao', 'cumprimento_sentenca', 'pedido_multa', 'homologacao_acordo',
    'manifestacao_defesa', 'recurso_ordinario', 'contrarrazoes_recurso_ordinario',
    'cumprimento_execucao_trabalhista', 'impugnacao_calculos', 'agravo_peticao',
    'cumprimento_alimentos', 'pedido_prisao_civil', 'justificativa_impossibilidade_pagamento'
  )
);
