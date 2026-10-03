# Changelog

## Não lançado

### Adicionado

- **Contrato com cláusulas completas, assinado pelos dois lados, e aba de assinaturas do
  administrador do aplicativo**: o contrato deixa de ser só tipo/valor de honorário e passa a
  gerar o texto de um contrato de prestação de serviços advocatícios comum — qualificação
  completa das partes (nome, CPF, OAB, escritório, endereços), objeto, honorários, forma de
  pagamento, obrigações recíprocas, prazo, rescisão, confidencialidade/LGPD e foro de eleição
  (`lib/contracts/clausulas.ts`, retrato gravado em `contracts.content` na criação — mudanças
  futuras no cadastro não alteram um contrato já redigido). O advogado agora também assina: ao
  enviar o contrato ao cliente (rascunho → enviado), ele confirma e assina como responsável pelo
  CONTRATADO, com a própria conta autenticada como prova (`assinarContratoAdvogado`, migração
  0024) — antes essa transição era só uma troca de status, sem nenhum registro de que o advogado
  responsável a fez. Do lado do cliente, a assinatura deixa de ser um único clique: agora exige
  redigitar o CPF usado na identificação do atendimento (nunca pré-preenchido), conferido contra o
  CPF cadastrado no caso antes de gravar a assinatura — um segundo dado de confirmação, além do
  clique, do IP e do instante, como prova mais real de quem assinou. Por fim, uma aba nova,
  "Assinaturas (app)", visível só para quem está logado com o e-mail configurado como
  administrador do aplicativo (`JURIS_ADMIN_EMAIL` — dono da plataforma, não admin de um
  escritório), lista toda assinatura de todo contrato já efetivado, de todos os escritórios,
  propositalmente fora do isolamento por escritório que vale para o resto da área profissional.
- **Consulta de atendimento por protocolo + CPF** (`/atendimento/meus`): além da lista de
  atendimentos deste navegador (mantida como estava), uma seção nova deixa consultar qualquer
  atendimento de outro aparelho ou navegador informando o protocolo e o CPF usado na
  identificação. É só consulta — não vincula o caso a esta sessão, nem permite continuar editando
  um rascunho a partir daí; um rascunho (ainda não finalizado) mostra o andamento sem dossiê, e um
  atendimento finalizado mostra o dossiê. Protocolo sozinho nunca foi credencial neste app; agora o
  CPF faz esse papel de segundo fator (`consultarAtendimentoPorProtocolo`,
  `lib/services/consulta-protocolo.ts`) — a mesma mensagem genérica aparece se o protocolo não
  existir, se o CPF não bater, ou se o atendimento não tiver CPF cadastrado, para nunca revelar
  qual dado está errado. Corrige o problema do botão "Meus atendimentos", que antes só listava o
  atendimento aberto por quem está logado/com aquele navegador, sem dar jeito de consultar pelo
  protocolo informado em outro lugar.
- **Cliente pode escolher o advogado no fim do atendimento (PR 2 de 2)**: nova etapa "Advogado",
  oferecida na revisão como opção — nunca obrigatória, para não travar quem usa uma instalação
  sem banco ou uma área sem nenhum advogado cadastrado ainda. Lista os advogados da área do caso
  (`listar_advogados_disponiveis`, PR 1), com filtro opcional por UF; escolher e confirmar já
  finaliza o atendimento no mesmo clique. A escolha revalida tudo de novo contra o banco
  (`escolher_advogado_atendimento`, migração 0023) — área, OAB confirmada, assinatura ativa —
  nunca confia na lista que o navegador mostrou, e passa a gravar `legal_cases.office_id` com o
  escritório do advogado escolhido, em vez do escritório único fixo de sempre. Funciona para quem
  nunca fez login (dono pelo hash da sessão anônima, não por conta). O botão "Atribuir" que o
  admin já tem na fila continua existindo, para reatribuir depois se precisar.
- **Base para o cliente escolher o advogado (PR 1 de 2)**: cadastro do advogado passa a pedir
  cidade/UF de atuação (distinto da UF da OAB) e ao menos uma área jurídica atendida
  (`profiles.cidade`/`uf`, nova tabela `lawyer_areas`, migração 0022). Nova função
  `listar_advogados_disponiveis()` monta um diretório **entre todos os escritórios** — só
  advogado com OAB confirmada e assinatura ativa, filtrável por área (obrigatório) e UF
  (opcional), em ordem aleatória para não favorecer sempre o mesmo nome. Ainda não há tela para o
  cliente usar isso — vem na PR seguinte, que troca a atribuição manual do admin (ou soma a ela)
  por essa escolha no fim do atendimento.
- **Aba "Contratos" na área profissional** (`/equipe/contratos`): lista todos os contratos gerados
  a partir dos atendimentos, com protocolo/título do caso, área, tipo e valor do honorário e
  status, sem precisar abrir caso por caso para achar um contrato específico. A política de RLS
  de `contracts`/`legal_cases` (já existente) decide o que cada ator enxerga.
- **Convite de equipe por e-mail** (`/equipe/time`): o advogado que cadastra o escritório agora
  monta o time convidando até 5 pessoas por e-mail, optando entre "advogado" (exige CPF e OAB) e
  "administrativo" (só CPF). O convite fica pendente até a pessoa convidada logar com esse
  e-mail — `aceitar_convite_equipe()` roda em todo login autenticado (`lib/auth/aceitar-convite.ts`)
  e vincula a conta ao escritório automaticamente, sem exigir que a pessoa convidada tenha
  passado por qualquer cadastro manual antes. A OAB de um convite de advogado é atribuída pelo
  próprio admin que convidou (`oab_verificado_por` grava quem convidou, nunca a própria pessoa —
  diferente da autodeclaração do cadastro self-service). O papel "administrativo" ainda não
  enxerga casos (mesma regra que já vale para "citizen") — é o próximo passo, que estende as
  políticas de RLS existentes para dar a ele o mesmo acesso de leitura/gestão do advogado, menos
  assinar. `remove_from_office` passou a soltar também um perfil "administrativo" e a limpar o
  CPF de quem sai da equipe, advogado ou não (migração 0021).
- **OAB autodeclarada no cadastro** (decisão consciente do dono do produto, trocando uma postura
  de segurança): o advogado passa a ter acesso a casos liberado na hora, sem esperar um admin
  checar manualmente o número contra o Cadastro Nacional dos Advogados. Como não existe
  verificação automática possível (OAB não tem dígito verificador público), a trilha de auditoria
  deixa isso explícito — `oab_verificado_por` grava a própria pessoa quando é autodeclaração, um
  admin de verdade quando foi checada. `/equipe/time` mostra "autodeclarada (não conferida)" nesse
  caso, com botão para um admin revogar a qualquer momento (`revoke_lawyer_oab`, migração 0020) —
  volta ao estado pendente e tira o acesso até alguém confirmar de novo.
- **CPF no atendimento**: o cidadão agora informa o CPF na identificação, validado pelo dígito
  verificador oficial (algoritmo da Receita Federal) — CPF com dígito errado ou sequência
  repetida (`00000000000`) não passa. Aparece na revisão e no dossiê final, ao lado dos demais
  dados do interessado.
- **E-mail no cadastro da equipe** (`/equipe/time`): cada membro aparecia só pelo identificador
  opaco da Neon Auth (um UUID). Agora `profiles.email` é gravado no momento do cadastro
  (cidadão, advogado) e atualizado de forma best-effort a cada visita a `/atendimento` ou
  `/equipe` — sem precisar de permissão administrativa na Neon Auth.
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
- **Atualizado para Next.js 16** (de 15.5.26), React 19.3 e `eslint-config-next` 16 — pré-requisito
  para o SDK oficial da Neon Auth (P2), que só suporta Next.js ≥ 16.
- **F3 (segunda peça) — correção de petição por IA**: botão "Corrigir com IA" em
  `/equipe/[caseId]/peticao`, seção por seção — nunca a petição inteira de uma vez. A sugestão
  aparece como proposta; só entra no texto quando o advogado clica em "Usar esta versão", e a
  seção aceita fica marcada como "revisado por IA" (`case_petitions.secoes_revisadas_ia`). Mesma
  infraestrutura do resumo de caso (Vercel AI Gateway); a instrução do modelo proíbe inventar
  fato, valor, data, lei ou jurisprudência fora do que já está escrito na seção.
- **Exclusão de atendimento, contrato e petição**: nenhuma das três tabelas tinha política nem
  GRANT de DELETE antes disso. Atendimento (pelo cidadão dono ou advogado/admin com acesso) e
  contrato só podem ser excluídos antes de aceitos/assinados — preserva a evidência do acordo já
  formalizado; petição não tem essa restrição. Primeiro uso de um diálogo de confirmação no app
  (`components/ui/confirm-submit-button.tsx`) antes de qualquer ação irreversível.
- **Arquivar atendimento, em qualquer status**: ao contrário da exclusão, sempre reversível e
  sem restrição — marca `legal_cases.archived_at` (migração 0018), oculta o caso das listas
  padrão (`/atendimento/meus`, fila da `/equipe`) sem apagar nada. Disponível para o cidadão dono
  e para advogado/admin com acesso; a fila da área profissional ganhou um filtro "Mostrar
  arquivados" para encontrá-los de novo.

### Alterado

- **Área profissional (`/equipe`), simplificada**: a aba lateral "Fila" passou a se chamar
  "Atendimento" (o título da página continua "Área profissional", que fica acima dela). Removida
  a aba/página "Auditoria" — cada processo já guarda seu próprio registro de ação (assinatura de
  contrato, assinatura de petição), então uma trilha consolidada à parte deixou de ser necessária;
  a função que só ela usava (`listarAuditoria`) foi removida junto, mas `registrarLeituraCaso`
  continua (a trilha por processo, embutida na página do caso). Os botões "Verificação em duas
  etapas" e "Gestão de equipe" saíram do topo da fila — o segundo já estava na barra lateral
  ("Equipe"); "Consultas externas" também saiu do topo e passou a só existir na lateral, onde já
  estava. O painel de números abaixo do título mostra agora só quatro cartões, sempre com a
  contagem (mesmo zero): Total, Em análise, Aguardando informações e Causa aceita — as demais
  famílias de status continuam filtráveis pela busca, só não têm mais cartão dedicado.
- **Consultas externas, sem Turivius e Jusfy**: os dois exigiam contrato comercial próprio (sem
  API pública) e foram retirados da lista de jurisprudência; Jusbrasil continua.

### Corrigido

- **Páginas públicas (`/`, "como funciona", privacidade) ficariam com todo script bloqueado** ao
  ativar a CSP com nonce, por serem pré-renderizadas em build (sem nonce nenhum). Corrigido
  forçando renderização por requisição em todo o app (`app/layout.tsx`). Bug pego só com teste
  manual em navegador real — nenhum teste E2E existente carregava essas páginas; teste de
  regressão adicionado em `seguranca-acessibilidade.spec.ts`.
- **"Voltar" no navegador depois de salvar oficialmente uma etapa mostrava dado desatualizado**
  (ex.: "rascunho restaurado" reaparecendo). Causa: o roteador do Next reaproveitava, no cliente,
  a versão em cache da página de antes da gravação — `Cache-Control: no-store` não evita esse
  reaproveitamento, que é só do lado do cliente. Corrigido com `BfcacheGuard`
  (`components/case/bfcache-guard.tsx`), que força `router.refresh()` em qualquer navegação por
  `popstate` dentro de `/atendimento`. Verificado como regressão real do Next.js 16 (ver
  histórico de commits), não reintroduzir.
- `eslint.config.mjs`: `eslint-config-next` 16 já exporta config flat nativa; o wrapper
  `FlatCompat.extends(...)` (necessário nas versões antigas) agora quebra com "Converting circular
  structure to JSON". Trocado por importar `eslint-config-next` diretamente.
- `components/draft/use-draft-autosave.ts`: `eslint-plugin-react-hooks` 7 (regras do React
  Compiler) sinalizou duas referências de `flush` a si mesma antes de `useCallback` terminar de
  declará-la (recursão e reagendamentos de retentativa). Substituído por um loop e por uma ref
  (`flushRef`) sempre atualizada — mesmo comportamento, sem a referência circular.

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
