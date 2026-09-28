# Verificação de produção — item P0

Data: 2026-09-28. Executado pelo Claude Code a partir de `PROXIMOS_PASSOS.md`.

## 1. Descoberta: o deploy publicado não era o da Sprint 4.1

Antes de qualquer correção, os dois deployments de produção mais recentes no
projeto Vercel `juris-office` estavam associados ao commit `7973c1c2...`
("Add files via upload"). Esse commit **não existe em nenhum lugar do
histórico do branch `main`** no GitHub (`git log --all`, `git merge-base
--is-ancestor` e `git rev-list --count origin/main` confirmam que `main` tem
hoje um único commit: `7662085181cab97ce6c3e1375459b2d7561af303`, "Sprint 4.1
e persistência em PostgreSQL (Neon)").

Conclusão: o site publicado estava rodando uma versão anterior ao Sprint 4.1
(provavelmente um upload manual pelo GitHub feito antes do histórico do
repositório ser reescrito/consolidado no commit único atual). Isso bate com o
que o `docs/RELATORIO-SPRINT-4.1.md` já suspeitava ("o site publicado ainda
está na versão da Sprint 4").

**Ação tomada** (autorizada pelo usuário): disparado um novo deployment de
produção a partir do commit correto via API da Vercel
(`gitSource: {type: "github", org: "ravilson-create", repo: "juris-office",
ref: "main", sha: "7662085181cab97ce6c3e1375459b2d7561af303"}`).

Resultado: deployment `dpl_44jc5vm7gkePApyDjR3MU74FaK3u`, estado `READY`,
alias `juris-office-eta.vercel.app` confirmado no proprio objeto do
deployment. Não foi possível ler os logs de build pela API (a chamada à
Vercel devolveu 403 pedindo reautenticação SSO no escopo do time), nem
acessar `https://juris-office-eta.vercel.app/api/saude` diretamente a partir
deste ambiente (a política de rede do ambiente bloqueia esse domínio: `curl`
falha com `CONNECT tunnel failed, response 403`, confirmado também via
`WebFetch` com `EGRESS_BLOCKED`).

**Confirmado pelo dono em 2026-09-28:** `https://juris-office-eta.vercel.app/api/saude`
responde `{"status":"ok","banco":"postgresql"}`. O deploy correto está no ar
e a persistência em Neon está ativa em produção.

## 2. Variáveis de ambiente inesperadas no projeto Vercel

Além das variáveis Neon esperadas (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
`NEON_PROJECT_ID`, `POSTGRES_*`, `PG*`), o projeto Vercel tem também:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `AI_PROVIDER_API_KEY`
- `SIGNATURE_PROVIDER_API_KEY`

O próprio README e o plano mestre dizem explicitamente que "Supabase, IA,
assinatura eletrônica e deploy não fazem parte desta fase". A origem dessas
variáveis não foi identificada (não aparecem em nenhum lugar do código desta
sprint). Ficam registradas aqui como pendência do dono: confirmar se são
resíduo de uma tentativa anterior/outro projeto ou se representam algo que
precisa de atenção (ex.: chave de serviço do Supabase exposta sem uso).
Nenhuma foi alterada ou removida.

## 3. Teste contra a Neon real (branch descartável)

Foi criada uma branch descartável no projeto Neon `neon-Juris-Office`
(`sweet-silence-24865867`): `teste-descartavel-p0`
(`br-shy-wave-b60u0kpi`), apagada ao final do teste.

Comando executado: `TEST_DATABASE_URL=<branch descartável> npm run
test:pg-real`.

**Resultado: majoritariamente reprovado** — 8 arquivos de teste falharam, 66
de 69 testes falharam, com erros repetidos `Connection terminated due to
connection timeout` / `Connection terminated unexpectedly` vindos do pool do
`pg`.

**Causa identificada:** o endpoint de compute da branch de teste (e também o
da branch `main`, verificado da mesma forma) está configurado com
`suspend_timeout_seconds: 0` — a Neon suspende o compute assim que ele fica
ocioso, sem nenhuma folga. A suíte de testes mantém um pool de conexões
aberto por mais de 10 minutos (664 s de duração); qualquer intervalo ocioso
entre consultas foi suficiente para a Neon suspender o compute e derrubar as
conexões do pool no meio do teste. Log completo do processo confirma:
`suspended_at` do compute da branch de teste bate com o intervalo em que os
testes começaram a falhar.

**Isso não é uma prova de que a persistência em PostgreSQL não funciona** —
os 3 testes que rodaram antes da primeira suspensão passaram, e o mesmo
código já foi validado (298 testes) contra PostgreSQL 16 local e PGlite. É,
porém, a primeira evidência real de que a configuração atual da Neon (mesmo
`suspend_timeout_seconds: 0` no branch de produção) pode causar quedas de
conexão em qualquer processo de vida mais longa que mantenha um pool aberto
— o que inclui, em tese, instâncias serverless da Vercel sob carga
sustentada, não só a suíte de testes.

**Recomendação (decisão do dono):** considerar aumentar
`suspend_timeout_seconds` do branch de produção na Neon (ex.: para alguns
minutos), avaliando o custo adicional de compute ocioso contra o risco de
conexões derrubadas em produção. Não alterado nesta verificação.

## 4. O que ficou confirmado

- O deploy de produção agora aponta para o commit correto do Sprint 4.1.
- A conexão TCP deste ambiente até a Neon funciona (usada para criar/testar/
  apagar a branch descartável); o bloqueio de rede afeta especificamente
  HTTPS para `*.vercel.app`, não Postgres.
- O código dos repositórios (migrador, `/api/saude`, `lib/db`) está
  inalterado nesta verificação — nenhuma mudança de código foi necessária.

## 5. O que ainda falta para fechar o P0

- [x] Confirmar `/api/saude` em produção — `ok`/`postgresql`.
- (dono) Confirmar no painel da Vercel que o build do novo deployment rodou
  `[migrate] aplicada: 0001_atendimentos.sql` (1ª aplicação) — não visível
  pela API neste ambiente por exigir reautenticação SSO.
- (dono) Decidir sobre as variáveis de ambiente do Supabase/IA/assinatura.
- (dono) Decidir sobre `suspend_timeout_seconds` do banco de produção.
- Fazer um atendimento completo end-to-end em produção e confirmar no banco
  que os dados sobrevivem a um novo deploy — ainda não executado.
