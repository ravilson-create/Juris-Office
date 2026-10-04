# Changelog

## Não lançado

### Adicionado

- **7 peças cíveis genéricas de defesa e execução**, nas mesmas Peças do processo
  (`/equipe/[caseId]/pecas`): impugnação à contestação, reconvenção, agravo de instrumento e
  suas contrarrazões, impugnação ao cumprimento de sentença, embargos à execução e exceção de
  pré-executividade. Cobrem o que faltava na fase de conhecimento (resposta a preliminar/
  documento novo da contestação, pedido do réu contra o autor) e na execução — a defesa do
  executado, tanto contra cumprimento de sentença (art. 525 CPC, par do `cumprimento_sentenca`
  já existente, do lado do credor) quanto contra execução de título extrajudicial, que não passa
  por sentença nenhuma (embargos à execução, art. 914 CPC, ou a defesa mais rápida e sem garantia
  do juízo da exceção de pré-executividade). Disponíveis para cível, consumidor, família e
  previdenciário; o agravo de instrumento genérico e sua contrarrazão, a impugnação ao
  cumprimento e as peças de execução de título extrajudicial não entram no rito trabalhista, que
  já tem suas próprias (agravo de petição, impugnação aos cálculos). Mesma tela, mesmo editor,
  mesma correção por IA (dentro da cota de 50/mês), mesma exportação em .docx/PDF.
- **4 peças de previdenciário, e endereçamento correto à Justiça Federal**, nas mesmas Peças do
  processo (`/equipe/[caseId]/pecas`): recurso inominado, contrarrazões ao recurso inominado,
  cumprimento de sentença contra a Fazenda Pública (RPV/precatório) e pedido de implantação
  imediata do benefício. Previdenciário corre na Justiça Federal (o INSS é Fazenda Pública) — a
  maioria das causas de benefício tramita no Juizado Especial Federal, onde o recurso contra a
  sentença se chama "Recurso Inominado" (não Apelação) e é endereçado, em contrarrazões, à Turma
  Recursal (não ao TRF). O cumprimento de sentença também segue rito próprio: o INSS não paga
  como devedor comum (sem a multa de 10% do art. 523, CPC) — por isso "Cumprimento de Sentença"
  comum deixou de ser listado para previdenciário, substituído pelo que cita o art. 535 do CPC e
  o art. 17 da Lei nº 10.259/2001. O endereçamento das peças genéricas (réplica, embargos,
  apelação, agravo de instrumento) também passou a reconhecer a área — "Juiz(a) Federal"/"Vara
  Federal ou Juizado Especial Federal"/"Tribunal Regional Federal" em vez de "Juiz(a) de
  Direito"/"Comarca"/"Tribunal de Justiça" (`lib/pecas/comum.ts`). Mesma tela, mesmo editor,
  mesma correção por IA (dentro da cota de 50/mês), mesma exportação em .docx/PDF.
- **3 peças de execução de alimentos (família)**, nas mesmas Peças do processo
  (`/equipe/[caseId]/pecas`): cumprimento de sentença de alimentos, pedido de prisão civil do
  devedor e justificativa de impossibilidade de pagamento — a execução de alimentos tem rito
  próprio (art. 528 do CPC, com risco de prisão civil do executado), bem diferente do
  cumprimento de sentença comum (art. 523), que continua existindo para as demais obrigações de
  família (ex.: partilha de bens). É o contencioso mais recorrente depois da sentença em causas
  de família — alimentos em atraso é o motivo mais comum de o processo continuar ativo. As
  demais peças já informadas para família (réplica, embargos de declaração, tutela de urgência,
  apelação, contrarrazões, homologação de acordo) já eram genéricas e já valiam para a área, sem
  nenhuma mudança. Mesma tela, mesmo editor, mesma correção por IA (dentro da cota de 50/mês),
  mesma exportação em .docx/PDF.
- **6 peças específicas do rito trabalhista (CLT)**, nas mesmas Peças do processo
  (`/equipe/[caseId]/pecas`): manifestação sobre a defesa e documentos, recurso ordinário,
  contrarrazões ao recurso ordinário, execução de sentença trabalhista (cumprimento + planilha de
  cálculos), impugnação à sentença de liquidação/aos cálculos e agravo de petição — as peças
  trabalhistas mais usadas no dia a dia, no lugar dos nomes e ritos cíveis que não existem na
  Justiça do Trabalho ("Apelação" lá é "Recurso Ordinário", "Cumprimento de Sentença" cita os
  arts. 876/880 da CLT em vez do art. 523 do CPC etc.). A tela só lista as peças que fazem
  sentido para a área do caso (`tiposDisponiveisParaArea`, `domain/pecas/schema.ts`) — um caso
  trabalhista não vê "Apelação"/"Réplica", um caso cível não vê "Recurso Ordinário"/"Agravo de
  Petição"; as peças genéricas (embargos de declaração, tutela de urgência, homologação de
  acordo) continuam em qualquer área. O endereçamento também passou a variar pela área —
  "Juiz(a) do Trabalho"/"Vara do Trabalho"/"Tribunal Regional do Trabalho" para trabalhista,
  mantendo "Juiz(a) de Direito"/"Comarca"/"Tribunal de Justiça" para as demais
  (`lib/pecas/comum.ts`). Mesma cota de 50 auxílios de IA por mês, mesmo editor, mesma exportação
  em .docx/PDF — nenhuma peça nova precisou de infraestrutura própria.
- **Peças pós-decisão, com auxílio de IA e limite mensal** (`/equipe/[caseId]/pecas`): as 8 peças
  mais comuns depois da petição inicial — réplica à contestação, agravo de instrumento contra
  indeferimento de tutela de urgência, embargos de declaração, apelação, contrarrazões de
  apelação, cumprimento de sentença, pedido de aplicação/majoração de multa (astreintes) e
  petição de homologação de acordo. Diferente da petição inicial (só a triagem, sem texto livre),
  o fato que origina cada peça (o que a contestação alegou, o que a decisão indeferiu) é só o
  advogado quem sabe — por isso cada tipo tem seu próprio formulário de campos livres
  (`domain/pecas/schema.ts#CAMPOS_PECA`); campo deixado em branco vira pendência, nunca é
  inventado (`lib/pecas/gerar.ts`). Reaproveita toda a infraestrutura da petição inicial —
  `case_petitions` ganhou só uma coluna `tipo` (migração 0025) — então o editor seção por seção,
  a correção de redação por IA, a exportação em .docx/PDF e a exclusão já funcionam sem nenhuma
  mudança.
- **Limite de 50 auxílios de IA por mês, por advogado**: a correção de redação por IA
  ("Corrigir com IA"), tanto na petição inicial quanto em qualquer peça pós-decisão, passa a
  contar contra uma cota mensal de 50 por advogado (`consumir_auxilio_ia()`/
  `auxilios_ia_restantes()`, migração 0025) — atômica, para duas chamadas simultâneas nunca
  passarem do limite. As duas telas mostram "Restam X de 50" no topo.
- **Contrato com cláusulas completas, assinado pelos dois lados**: o contrato deixa de ser só
  tipo/valor de honorário e passa a gerar o texto de um contrato de prestação de serviços
  advocatícios comum — qualificação completa das partes (nome, CPF, OAB, escritório, endereços),
  objeto, honorários, forma de pagamento, obrigações recíprocas, prazo, rescisão,
  confidencialidade/LGPD e foro de eleição (`lib/contracts/clausulas.ts`, retrato gravado em
  `contracts.content` na criação — mudanças futuras no cadastro não alteram um contrato já
  redigido). O advogado agora também assina: ao enviar o contrato ao cliente (rascunho →
  enviado), ele confirma e assina como responsável pelo CONTRATADO, com a própria conta
  autenticada como prova (`assinarContratoAdvogado`, migração 0024) — antes essa transição era só
  uma troca de status, sem nenhum registro de que o advogado responsável a fez. Do lado do
  cliente, a assinatura deixa de ser um único clique: agora exige redigitar o CPF usado na
  identificação do atendimento (nunca pré-preenchido), conferido contra o CPF cadastrado no caso
  antes de gravar a assinatura — um segundo dado de confirmação, além do clique, do IP e do
  instante, como prova mais real de quem assinou.
- **Aba "Assinaturas de advogados" do administrador do aplicativo** (`/equipe/assinaturas`,
  visível só para quem está logado com o e-mail configurado em `JURIS_ADMIN_EMAIL` — dono da
  plataforma, não admin de um escritório): lista a mensalidade (Asaas) de cada advogado
  cadastrado — teste grátis, ativa, em atraso ou cancelada, com e-mail, escritório, plano e link
  da fatura —, de todos os escritórios da plataforma, propositalmente fora do isolamento por
  escritório que vale para o resto da área profissional (`listarAssinaturasAdvogados`,
  `lib/services/equipe-assinaturas.ts`). O status reflete o que o webhook da Asaas
  (`app/api/webhooks/asaas`) grava a partir dos eventos de pagamento — continua exigindo
  configurar esse webhook no painel da Asaas para um cadastro novo aparecer como "Ativa" de fato.
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
- **Contrato: cláusulas completas não apareciam** (`/equipe/[caseId]/contrato`): o documento
  completo das cláusulas ficava escondido atrás de um `<details>` recolhido por padrão enquanto o
  contrato estava em rascunho — exatamente a situação logo após criar um contrato novo, quando o
  advogado mais precisa ver o texto antes de assinar e enviar. Só a linha-resumo (tipo de
  honorário e percentual) ficava visível. O documento agora aparece sempre, sem recolher. Também
  passou a tratar com segurança um contrato criado antes desta função existir (campo `content`
  vazio, `temClausulasCompletas()`) — mostra um aviso em vez de quebrar a página.

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
