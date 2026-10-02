-- Arquivar o atendimento, em qualquer status — ao contrário da exclusão (migração 0017), que é
-- restrita e irreversível, arquivar só marca `archived_at` (sempre reversível, nenhum dado some)
-- e serve para tirar o caso das listas padrão sem apagar nada. As políticas de UPDATE já
-- existentes (citizen_case_update e lawyer_case_status_update) não restringem coluna nenhuma,
-- então já cobrem esta também — nenhuma política nova é necessária.
ALTER TABLE legal_cases ADD COLUMN archived_at timestamptz;
