# Revisão de segurança — Júris Office IA (Fase F1, Sprint 4)

Data: 27/09/2026. Escopo: MVP local com dados simulados (sem banco, login ou upload real).
Referência: seção 13 (Privacidade, LGPD e segurança) do plano mestre.

## Requisitos do plano × situação

| Requisito                                | Situação na F1                                                                                                                                                                                                                                                     | Evolução prevista                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Coletar só o necessário                  | Identificação com 5 campos + ciência; sem CPF, RG ou endereço completo. O relato orienta a não incluir senhas e dados bancários.                                                                                                                                   | Revisar campos com o jurídico antes da produção.                                                              |
| Informar finalidade / ciência            | Caixa de ciência obrigatória na identificação; página de Privacidade.                                                                                                                                                                                              | Textos de Termos, Privacidade e bases legais: **revisão jurídica obrigatória** antes de produção.             |
| Restringir acesso por perfil             | Cada atendimento fica vinculado ao navegador que o criou (cookie `jo_sessao` httpOnly, SameSite=Lax, Secure em produção; o caso guarda só o hash SHA-256). Outro navegador recebe 404, sem revelar se o caso existe. Toda Server Action passa pela mesma checagem. | F5: Supabase Auth + RLS por `citizen`, `lawyer`, `admin`, e por `case_assignments` (sigilo advogado–cliente). |
| Validar uploads, limites e tipos         | Extensão × tipo MIME, 10 MB por arquivo, 20 por atendimento, nome sanitizado (sem caminho nem caracteres de controle). Validado no navegador e no servidor.                                                                                                        | F5: verificação do conteúdo real no Storage (assinatura do arquivo) e antivírus.                              |
| URLs de arquivos não públicas            | Não há arquivos armazenados (envio simulado).                                                                                                                                                                                                                      | F5: buckets privados, URLs assinadas de curta duração.                                                        |
| Sanitizar e validar entradas             | Zod em todas as fronteiras; limites de tamanho nas ações (respostas até 10.000 caracteres, até 100 campos, listas até 50 itens; relato até 8.000). React escapa a saída.                                                                                           | Manter schemas compartilhados com o banco.                                                                    |
| Não registrar dados pessoais em logs     | O único log do servidor registra o tipo do erro, sem conteúdo nem identificadores.                                                                                                                                                                                 | Observabilidade com mascaramento de dados.                                                                    |
| Sem stack traces em produção             | Mensagens genéricas ao usuário; tela de erro mostra só um código (digest) para suporte; `global-error` para falhas do layout.                                                                                                                                      | —                                                                                                             |
| Variáveis de ambiente / chaves           | Nenhum segredo no código; `.env.example` sem valores.                                                                                                                                                                                                              | Service role do Supabase só no servidor.                                                                      |
| Registrar ações relevantes (auditoria)   | Não aplicável sem banco.                                                                                                                                                                                                                                           | F5: tabela `audit_logs`.                                                                                      |
| Retenção e exclusão                      | Dados em memória, apagados ao reiniciar o servidor.                                                                                                                                                                                                                | Política de retenção a definir com o jurídico (prazos processuais × dados pessoais).                          |
| Não treinar modelos com dados do cidadão | Não há IA na F1.                                                                                                                                                                                                                                                   | Cláusula contratual com o provedor de IA (F3).                                                                |

## Medidas adicionais aplicadas

- **Cabeçalhos HTTP** (`next.config.ts`): Content-Security-Policy (sem objetos, sem frames de terceiros, formulários só para a própria origem), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (o link do atendimento não vaza para outros sites), `Permissions-Policy` bloqueando câmera, microfone, localização e pagamento, `Cross-Origin-Opener-Policy`, HSTS em produção e remoção do `X-Powered-By`.
- **Páginas de atendimento**: `X-Robots-Tag: noindex`, meta robots e `robots.txt` bloqueando `/atendimento`; `Cache-Control: private, no-store`.
- **Dependências**: `npm audit` sem vulnerabilidades. O PostCSS embutido no Next 15 (8.4.31, com alertas de segurança) foi forçado para 8.5.28 via `overrides`, sem trocar a versão principal do framework.

## Limitações conhecidas (aceitas para a F1)

1. **Vínculo por navegador não é autenticação.** Limpar cookies ou trocar de aparelho faz a pessoa perder o acesso ao atendimento. Aceitável para testes; resolvido com login na F5.
2. ~~CSP com `'unsafe-inline'` em scripts~~ Resolvido: nonce por requisição em `script-src`
   (`middleware.ts`), gerado a cada requisição e aplicado pelo próprio Next.js aos scripts que
   ele injeta na hidratação. Exigiu forçar toda página a renderizar por requisição
   (`app/layout.tsx`, `dynamic = "force-dynamic"`) — uma página pré-renderizada em build nunca
   teria o nonce certo, e todo script nela ficaria bloqueado (bug real, encontrado e corrigido
   nesta mudança; teste de regressão em `seguranca-acessibilidade.spec.ts`). `style-src` continua
   com `'unsafe-inline'`: o Next injeta alguns estilos inline sem propagar nonce a eles, e o risco
   de um estilo injetado é bem menor que o de um script.
3. ~~Sem limite de requisições (rate limiting).~~ Resolvido: limite por IP/sessão no banco (ver seção de persistência abaixo) e limpeza periódica.
4. **Armazenamento em memória sem teto.** Só ocorre com `ALLOW_MEMORY_STORE=1`, nunca definido na Vercel; desaparece com o banco.
5. **Envio de arquivos simulado.** Nenhum conteúdo é recebido; a validação de conteúdo real fica para a F5.

## Como verificar

- `npm run test` — inclui testes do controle de acesso (`tests/unit/case-access.test.ts`).
- `npm run test:e2e` — `tests/e2e/seguranca-acessibilidade.spec.ts` verifica cabeçalhos, bloqueio de acesso entre navegadores, queda de conexão e acessibilidade (axe, WCAG 2.1 AA) em toda a jornada.
- `npm audit` — dependências.

## Persistência em PostgreSQL (Neon) — Sprint 4.1

**Feito e verificado**

- Credenciais do banco só em variáveis de ambiente do servidor (`DATABASE_URL`); nada no navegador,
  nos logs ou no repositório (`.env.example` não tem valores).
- Todas as consultas usam parâmetros (`$1`, `$2`…): nenhuma concatenação de texto do usuário em SQL.
- Restrições no banco, além das validações da aplicação: protocolo único, (caso, versão) do
  dossiê único, status válidos, coerência entre "finalizado" e a data de finalização, hash de
  sessão no formato esperado e chaves estrangeiras com exclusão em cascata.
- Finalização e limite de documentos são atômicos no banco (transação com bloqueio da linha do
  caso). Verificado contra PostgreSQL 16 real com conexões paralelas: 20 finalizações simultâneas
  geram 1 dossiê; 40 inclusões simultâneas geram exatamente 20 documentos. Retirado o bloqueio, o
  teste falha (27 e 30 documentos), o que confirma que ele detecta a corrida.
- Em produção sem banco, o app recusa usar a memória; `/api/saude` acusa a configuração errada.

**Limitações conhecidas (não resolvidas)**

- **Sem autenticação nem RLS**: o app acessa o banco com um único papel; o isolamento entre
  atendimentos depende do cookie de sessão e do código. RLS só faz sentido com autenticação real.
- ~~Papel do banco com privilégio total~~ Resolvido em parte: papel `juris_app`, só com
  SELECT/INSERT/UPDATE/DELETE nas tabelas do app (`APP_DATABASE_URL`, ver docs/NEON-VERCEL.md
  §3.1); migrações continuam com o papel dono. Limitação da Neon: `CREATEDB`/`CREATEROLE` do papel
  não podem ser revogados por SQL nesse plano — o papel não altera o esquema, mas em teoria
  poderia criar banco/papel novo dentro do mesmo projeto Neon.
- **Backups**: confirmado — plano Neon `free_v3`, janela de restauração (PITR) de **6 horas**
  (`history_retention_seconds: 21600`). Não é configurável nesse plano (a Neon recusa mudar
  `suspend_timeout_seconds` pelo mesmo motivo). Um incidente percebido depois de 6 horas não tem
  como ser restaurado a um ponto anterior — só planos pagos da Neon (Launch/Scale) ampliam essa
  janela (7 a 30 dias). Decisão do dono: aceitar o risco enquanto o app só tem dados fictícios, ou
  avaliar upgrade de plano antes de dados reais (P2 em diante).
- Conexões paralelas foram testadas em PostgreSQL 16 local, **não** contra a Neon.
- Concorrência entre instâncias serverless na _leitura-e-gravação_ de respostas da triagem é
  "última gravação vence"; a finalização não é afetada (verifica a revisão do caso no banco).
- Arquivos continuam simulados; armazenamento privado de arquivos ainda não existe.

## Limite de requisições e limpeza periódica (P1)

- **Limite de requisições**: contador em `rate_limit_hits` (janela fixa), aplicado a criação de
  atendimento (por IP), salvamento de rascunho e inclusão de documento (por sessão). Sem banco
  configurado, nunca limita — não há como um processo local abusar de si mesmo.
- **Limpeza periódica**: `app/api/cron/limpeza`, chamada pelo Vercel Cron uma vez por dia,
  protegida por `CRON_SECRET` (a rota recusa sem o segredo certo — fecha por padrão). Remove
  atendimentos de teste não finalizados há mais de 30 dias e finalizados há mais de 90 dias;
  exclusão em cascata já existente cuida dos dados relacionados (respostas, documentos, dossiês,
  rascunhos). Prazos provisórios, propostos pelo plano mestre — revisar com o dono do produto
  quando houver volume real de uso.
- **Como verificar**: `tests/postgres/limite-requisicoes.test.ts` e `tests/postgres/limpeza.test.ts`
  (rodam contra PGlite e, com `TEST_DATABASE_URL`, contra PostgreSQL real).

## Observabilidade (P1)

Auditoria do código: existe apenas **um** `console.error` em todo o app
(`app/atendimento/actions.ts`), e ele já registra só o **nome da classe do erro**
(`error.name`), nunca a mensagem, a pilha ou dados do formulário — confirmado pela leitura de
`app/**`, `lib/**`, `domain/**` e `components/**` (nenhum outro `console.*` fora de scripts de
build). Não havia nada para corrigir aqui.

O que falta é ativar o produto **Vercel Observability** (erros e latência agregados) no
dashboard do projeto — não há chamada de API para isso a partir daqui; é uma decisão/ação do
dono na Vercel.

## F3 — Resumo de caso por IA: envio de dado a terceiro

O botão "Gerar resumo com IA" (`/equipe/[caseId]`) envia o **dossiê do caso** — fatos, partes,
cronologia, dados do requerente — ao modelo configurado em `AI_GATEWAY_MODEL`, via Vercel AI
Gateway (mesmo padrão já usado no Orça Valida — `ai` SDK, sem instanciar SDK de provedor
específico), para processar e devolver o resumo estruturado. **Confirmado com o dono do produto
antes de implementar** (sem anonimização prévia): é dado jurídico de terceiros saindo da
infraestrutura própria, repassado pelo Gateway ao provedor por trás do modelo escolhido.

Mitigações:
- **Nunca automático**: só roda quando o advogado clica, nunca em lote nem no envio do caso.
- **Fonte única é o dossiê**, não a triagem bruta nem documentos anexados — já é a mesma
  organização determinística mostrada ao advogado, nada além disso é exposto.
- **Rate limit** de 10 gerações/hora por caso (`checkRateLimit`), para conter custo e abuso.
- **RLS idêntica** à do resto do caso (`case_ai_summaries`: advogado/admin com acesso ao caso).
- O resultado é sempre rotulado como gerado por IA, nunca como fato confirmado, e nunca alimenta
  automaticamente a decisão de viabilidade — o advogado decide o que usar.
- O modelo de fato usado (resolvido pelo Gateway) fica gravado em `case_ai_summaries.modelo`,
  não só a string configurada — rastreabilidade de qual provedor processou cada resumo.

Pendente: revisar com o dono se o provedor por trás do modelo escolhido em `AI_GATEWAY_MODEL`
precisa constar como operador de dados no contrato com o cliente final, conforme a LGPD, antes
de habilitar em produção com casos reais.

## F3 (segunda peça) — Correção de petição por IA: envio de dado a terceiro

O botão "Corrigir com IA" (`/equipe/[caseId]/peticao`, por seção) envia à mesma infraestrutura
(Vercel AI Gateway, `AI_GATEWAY_MODEL`) o texto já gerado de **uma seção** da petição, mais a
área e o tipo de ação — nunca o dossiê inteiro nem dado do cliente além do que já está escrito
naquela seção.

Mitigações:
- **Nunca automático e nunca em lote**: uma seção por vez, só quando o advogado clica.
- **Sugestão, não substituição**: o texto corrigido aparece como proposta; só entra na petição
  quando o advogado clica em "Usar esta versão" — o salvamento continua sendo uma ação separada
  e explícita ("Salvar alterações").
- **Instrução do modelo proíbe inventar** fato, valor, data, nome, lei ou jurisprudência que não
  esteja já no texto recebido, e exige copiar qualquer `[PENDENTE: ...]` sem alteração.
- Seção aceita fica marcada como "revisado por IA" (`case_petitions.secoes_revisadas_ia`),
  rastreável mesmo que o advogado edite o texto depois de aceitar.
- Mesma RLS da petição (`case_petitions`: advogado/admin com acesso ao caso).

## Exclusão de atendimento, contrato e petição

Nenhuma das três tabelas tinha política nem GRANT de DELETE antes desta mudança — eram
operações impossíveis mesmo para quem tinha acesso de leitura/escrita ao caso. Agora:

- **Atendimento**: o cidadão dono (conta ou sessão anônima) e advogado/admin com acesso podem
  excluir, mas só **antes** de a causa ser aceita ou entrar em negociação/andamento (`isDeletable`
  em `domain/case/status.ts`, espelhado na RLS da migração 0017). Depois disso normalmente já
  existe contrato — a exclusão fica bloqueada para preservar essa evidência. Apagar o atendimento
  cascateia triagem, documentos, rascunhos, petições e contrato; a auditoria (`audit_logs`)
  sobrevive com `case_id = NULL` (ela não é apagada, só perde a referência ao caso).
- **Contrato**: só em rascunho ou cancelado — nunca enviado ou assinado, pela mesma razão que a
  transição de status de um contrato assinado já era bloqueada (preserva o acordo de honorários
  formalizado com o cliente).
- **Petição**: sem restrição de status — qualquer versão gerada pode ser excluída
  independentemente, sem afetar as demais.

Nenhum diálogo de confirmação existia no app antes disso; todo botão de exclusão agora usa
`components/ui/confirm-submit-button.tsx` (confirmação do navegador antes de enviar o formulário).
