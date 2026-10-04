-- Peças cíveis genéricas (contrato, indenização, cobrança) que ainda não tinham equivalente:
-- impugnação à contestação e reconvenção (fase de conhecimento); agravo de instrumento
-- genérico (art. 1.015 CPC, distinto do agravo_tutela, que já cobre só a hipótese de tutela de
-- urgência) e suas contrarrazões; e as três peças de defesa na execução — impugnação ao
-- cumprimento de sentença (par do credor "cumprimento_sentenca", migração 0025), embargos à
-- execução (quando o título é extrajudicial, não decorre de sentença) e exceção de
-- pré-executividade (defesa sem garantia do juízo, restrita a matéria de ordem pública).
-- Não entram no rito trabalhista (ver EXCETO_TRABALHISTA em domain/pecas/schema.ts).
ALTER TABLE case_petitions DROP CONSTRAINT case_petitions_tipo_check;
ALTER TABLE case_petitions ADD CONSTRAINT case_petitions_tipo_check CHECK (
  tipo IN (
    'peticao_inicial', 'replica', 'agravo_tutela', 'embargos_declaracao', 'apelacao',
    'contrarrazoes_apelacao', 'cumprimento_sentenca', 'pedido_multa', 'homologacao_acordo',
    'manifestacao_defesa', 'recurso_ordinario', 'contrarrazoes_recurso_ordinario',
    'cumprimento_execucao_trabalhista', 'impugnacao_calculos', 'agravo_peticao',
    'cumprimento_alimentos', 'pedido_prisao_civil', 'justificativa_impossibilidade_pagamento',
    'recurso_inominado', 'contrarrazoes_recurso_inominado', 'cumprimento_fazenda_publica',
    'implantacao_beneficio',
    'impugnacao_contestacao', 'reconvencao', 'agravo_instrumento',
    'contrarrazoes_agravo_instrumento', 'impugnacao_cumprimento', 'embargos_execucao',
    'excecao_pre_executividade'
  )
);
