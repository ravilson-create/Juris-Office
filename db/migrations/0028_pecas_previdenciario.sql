-- Peças de previdenciário — corre na Justiça Federal (INSS é Fazenda Pública), com nomes e rito
-- próprios: Recurso Inominado (JEF) em vez de Apelação, cumprimento contra a Fazenda Pública
-- (RPV/precatório) em vez do cumprimento comum, e o pedido de implantação imediata do
-- benefício, separado do pagamento dos atrasados.
ALTER TABLE case_petitions DROP CONSTRAINT case_petitions_tipo_check;
ALTER TABLE case_petitions ADD CONSTRAINT case_petitions_tipo_check CHECK (
  tipo IN (
    'peticao_inicial', 'replica', 'agravo_tutela', 'embargos_declaracao', 'apelacao',
    'contrarrazoes_apelacao', 'cumprimento_sentenca', 'pedido_multa', 'homologacao_acordo',
    'manifestacao_defesa', 'recurso_ordinario', 'contrarrazoes_recurso_ordinario',
    'cumprimento_execucao_trabalhista', 'impugnacao_calculos', 'agravo_peticao',
    'cumprimento_alimentos', 'pedido_prisao_civil', 'justificativa_impossibilidade_pagamento',
    'recurso_inominado', 'contrarrazoes_recurso_inominado', 'cumprimento_fazenda_publica',
    'implantacao_beneficio'
  )
);
