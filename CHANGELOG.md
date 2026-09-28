# Changelog

## Não lançado

### Adicionado
- **Limite de requisições** (P1 do plano mestre): criação de atendimento (30/hora por IP),
  salvamento de rascunho (300/hora por sessão) e inclusão de documento (60/hora por sessão),
  contados em `rate_limit_hits` no banco. Sem banco (memória/dev), nunca limita.
- **Limpeza periódica**: rota `app/api/cron/limpeza`, chamada pelo Vercel Cron (`vercel.json`,
  diariamente às 5h UTC), protegida por `CRON_SECRET`. Remove atendimentos de teste não
  finalizados há mais de 30 dias e finalizados há mais de 90 dias (prazos provisórios, a
  revisar com o dono do produto quando houver volume real de uso).
- **CI no GitHub Actions**: lint, typecheck, build, `npm audit`, testes (memória/PGlite e
  PostgreSQL real via serviço do Actions) e E2E, a cada push/PR em `main`. Dependabot semanal.
- **Papel de banco restrito para o app** (`juris_app`, só SELECT/INSERT/UPDATE/DELETE, sem DDL),
  usado via `APP_DATABASE_URL`; migrações continuam com o papel dono. Ver docs/NEON-VERCEL.md §3.1.
- **CSP com nonce por requisição** em `script-src`, substituindo `'unsafe-inline'`.

### Corrigido
- **Páginas públicas (`/`, "como funciona", privacidade) ficariam com todo script bloqueado** ao
  ativar a CSP com nonce, por serem pré-renderizadas em build (sem nonce nenhum). Corrigido
  forçando renderização por requisição em todo o app (`app/layout.tsx`). Bug pego só com teste
  manual em navegador real — nenhum teste E2E existente carregava essas páginas; teste de
  regressão adicionado em `seguranca-acessibilidade.spec.ts`.

## Sprint 4.1 + persistência em PostgreSQL (Neon) — 2026-09-28

### Corrigido
- **Finalização duplicada sob concorrência**: finalização idempotente, com trava por atendimento,
  controle otimista por revisão do caso e gravação atômica do dossiê e do status.
- **Valores monetários**: parser estrito em centavos inteiros (`1.2.3` e `1.2345` agora são recusados).
- **Quantidade de filhos** aceitava `1,5`: nova regra `integer`, configurável por pergunta.
- **Datas do vínculo de trabalho**: término anterior ao início é recusado (regra `notBefore`).
- **Respostas condicionais antigas** voltavam sem reconfirmação: o caso inteiro é reavaliado.
- **Limite de 20 documentos** furado por inclusões simultâneas: inclusão atômica.
- **Fuso horário**: política central (UTC guardado, America/Sao_Paulo exibido; datas dos fatos sem conversão).
- **Nome do app vazio** (`O faz as perguntas certas`): `NEXT_PUBLIC_APP_NAME` vazio agora usa o padrão.
- **Travamento intermitente** após salvar identificação/triagem/relato: a navegação passou a ser
  feita pelo servidor (ver relatório, item I).

### Adicionado
- **Persistência em PostgreSQL (Neon)**: esquema versionado (`db/migrations`), migrador idempotente
  (`npm run db:migrate`, também no build da Vercel), cinco repositórios PostgreSQL, restrições
  UNIQUE/CHECK/FOREIGN KEY e `/api/saude`.
- **Rascunhos** de identificação, triagem e relato, com estados reais de salvamento e aviso ao sair.
- **Meus atendimentos** (`/atendimento/meus`), filtrado no servidor pela sessão.
- Aviso permanente de **ambiente de testes**; textos revisados para não prometer envio a advogado.
- Testes: 229 na memória + 69 em PostgreSQL (PGlite) + suíte opcional em PostgreSQL real; 5 áreas em E2E.

### Alterado
- Em produção, o app **recusa** usar a memória do servidor sem `ALLOW_MEMORY_STORE=1`.
- Site fora de buscadores por padrão (`INDEXAR_SITE=1` no build libera).
- Roadmap: persistência real e autenticação antes de dados reais, contratos ou IA.
