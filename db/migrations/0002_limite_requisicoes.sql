-- Contador de requisições por janela fixa, usado para limitar abuso (P1 do plano mestre).
-- rate_key identifica o que está sendo limitado (ex.: "criar-atendimento:<ip>"); window_start
-- é o início da janela de tempo (arredondado); hits conta quantas vezes a chave apareceu nela.

CREATE TABLE rate_limit_hits (
  rate_key     text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 1 CHECK (hits > 0),
  PRIMARY KEY (rate_key, window_start)
);

-- Usado pela limpeza periódica para apagar janelas já encerradas.
CREATE INDEX rate_limit_hits_window_idx ON rate_limit_hits (window_start);
