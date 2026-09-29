# Júris Office IA

Plataforma de suporte integral à advocacia: captação e triagem do cliente, definição da causa,
fechamento de contrato, apoio jurídico, produção de peças e acompanhamento processual com alertas.

> **Nomes:** o projeto/repositório chama-se **Júris IA**; o aplicativo entregue ao usuário final
> chama-se **Júris Office IA**. Apenas este último aparece na interface.

## Escopo atual — Fase F1 concluída, Sprint 4.1 e persistência em PostgreSQL (Neon)

**Novidades da Sprint 4.1** (detalhes em [CHANGELOG.md](CHANGELOG.md) e
[docs/RELATORIO-SPRINT-4.1.md](docs/RELATORIO-SPRINT-4.1.md)): sete correções de confiabilidade,
rascunhos, "Meus atendimentos", textos que não prometem envio a advogados e persistência em
PostgreSQL (Neon). Para publicar: [docs/NEON-VERCEL.md](docs/NEON-VERCEL.md).

Implementado:

- Fundação: Next.js 16 (App Router), TypeScript strict, Tailwind CSS 4, Zod 4, React Hook Form.
- Home, "Como funciona" e página de privacidade (texto provisório).
- Escolha entre as cinco áreas: Consumidor, Trabalhista, Família, Previdenciário e Cível.
- Criação do caso em rascunho com protocolo provisório (`JO-AAAAMMDD-XXXXXX`).
- Identificação mínima do interessado com ciência sobre o uso dos dados.
- Engine de triagem **orientada a dados**: perguntas por área, agrupadas em etapas, com perguntas
  condicionais, validação idêntica no navegador e no servidor, retomada e correção.
- **Relato livre** com orientação neutra, contador de caracteres e limites (30 a 8.000).
- **Documentos**: checklist por área (recomendados e "se tiver") + "Outros documentos". Upload
  **simulado**: o arquivo não sai do aparelho; só nome, tipo e tamanho são registrados. Aceita
  PDF, JPG, PNG, WEBP e DOCX, até 10 MB cada e 20 por atendimento, com validação no navegador e no
  servidor e limpeza do nome do arquivo.
- **Revisão** em formato de prévia do dossiê (cabeçalho timbrado), com link "Corrigir" em cada
  seção; após salvar a correção, a pessoa volta direto para a revisão.
- **Dossiê jurídico preliminar** montado de forma **determinística** (sem IA), com as 11 seções do
  plano: identificação, síntese do relato (o relato original é preservado sem alterações),
  informações da triagem, partes, linha do tempo, valores, documentos, providências, informações
  ainda necessárias, observações e aviso de revisão profissional. O dossiê é um retrato do envio:
  fica salvo com versão e não muda se perguntas ou checklists forem alterados depois.
- **Envio e protocolo**: "Confirmar e enviar" gera o dossiê, marca o caso como `submitted` e mostra
  a tela de protocolo com os próximos passos. Depois do envio, as telas de edição levam ao protocolo.
- **Impressão/PDF**: botão "Imprimir ou salvar em PDF" com layout A4 próprio (sem cabeçalho,
  rodapé ou botões; símbolo monocromático; texto em preto).
- Status do caso: `triage` → `awaiting_documents` (relato salvo) → `ready_for_review` → `submitted`.
- Persistência mock em memória, atrás de interfaces de repositório (troca por Supabase na F5).
- Tipos de domínio já definidos para os módulos futuros: contrato, peças e prazos.

- **Acabamento (Sprint 4)**: auditoria automática de acessibilidade (axe, WCAG 2.1 AA) sem
  violações em toda a jornada; foco e título por etapa na triagem; sem rolagem horizontal a 320 px;
  falhas de rede tratadas nos formulários; erros de regra levam à etapa certa; tela de erro com
  código de suporte e erro global; estado vazio na escolha de área.
- **Segurança (Sprint 4)**: atendimento vinculado ao navegador que o criou (cookie httpOnly; outro
  navegador recebe 404), cabeçalhos HTTP de segurança, páginas de atendimento fora de buscadores e
  de cache compartilhado, limites de tamanho nas entradas e dependências sem vulnerabilidades.
  Detalhes e limitações em **[SECURITY.md](SECURITY.md)**.

Ainda **não** implementado (próximas fases): acompanhamento do caso pelo cliente; portal do advogado, contrato, IA, peças e prazos
(fases F2 a F6). Supabase, IA, assinatura eletrônica e deploy não fazem parte desta fase.

## Identidade visual

- Marca: **Júris Office** (símbolo "J" em azul-marinho com folhas em verde-água); o app exibe o selo **IA**.
- Arquivos em `public/brand/`: `juris-office-simbolo.png` (símbolo colorido, fundo transparente),
  `juris-office-simbolo-mono.png` (silhueta monocromática), `juris-office-icone.png` (ícone do app)
  e `proposta-logo-original.png` (arte de referência).
- Componentes em `components/brand/brand-logo.tsx`: `BrandSymbol` (colorido), `BrandSymbolMono`
  (pinta com a cor do texto), `BrandWordmark` e `BrandLogo`.
- Onde aparece: cabeçalho (logo colorida), página inicial (símbolo grande), rodapé (versão
  monocromática) e cabeçalho timbrado do dossiê (`components/dossier/dossier-letterhead.tsx`),
  que usa o símbolo colorido na tela e o monocromático na impressão.
  `app/icon.png` e `app/apple-icon.png` geram o favicon e o ícone de tela inicial.
- Cores (tokens em `app/globals.css`): azul-marinho `#032f5b` (primária) e verde-água `#13ab9f`
  (acento decorativo). Para texto e foco use `teal-strong` (`#0b7a70`), pois o verde-água puro não
  atinge o contraste mínimo sobre branco.
- Os recortes vieram de uma imagem rasterizada; quando houver o arquivo vetorial (SVG/PDF/AI) da logo,
  substitua os PNGs para ganhar nitidez em telas de alta densidade.

## Requisitos

- Node.js 20.9 ou superior (testado com Node 22)
- npm 10+

## Instalação e execução

```bash
npm install
cp .env.example .env.local   # opcional nesta fase
npm run dev                  # http://localhost:3000
```

## Comandos

| Comando             | O que faz                                               |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                             |
| `npm run build`     | Build de produção                                       |
| `npm start`         | Executa o build de produção                             |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | Verificação de tipos                                    |
| `npm test`          | Testes unitários e de integração (Vitest)               |
| `npm run test:e2e`  | Testes de ponta a ponta (Playwright, desktop e celular) |
| `npm run check`     | Lint + typecheck + testes + build                       |
| `npm run format`    | Prettier                                                |

Para os testes E2E, rode antes `npm run build` e instale o navegador uma vez com
`npx playwright install chromium`. Se já houver um Chromium na máquina, use
`PLAYWRIGHT_CHROMIUM_PATH=/caminho/do/chrome npm run test:e2e`.

## Arquitetura

```
UI (app/, components/)  →  Server Actions (app/atendimento/actions.ts)
                        →  Services (lib/services)
                        →  Repositórios (lib/repositories/types.ts)
                             ├─ mock/ (hoje, memória do servidor)
                             └─ supabase/ (fase F5)
Domínio (domain/): schemas Zod, tipos derivados e regras puras (status, protocolo, triagem)
```

Princípios: a UI nunca acessa persistência diretamente; tipos são derivados dos schemas Zod;
toda regra de validação da triagem roda igual no navegador e no servidor; nenhum segredo no
cliente; erros internos não são expostos ao usuário.

### Estrutura de pastas

```
app/
  (public)/                 home, como-funciona, privacidade
  atendimento/              escolha da área + server actions
    [caseId]/identificacao  dados de contato
    [caseId]/triagem        perguntas por etapa (?etapa=N)
    [caseId]/relato         relato livre
    [caseId]/documentos     checklist + upload simulado
    [caseId]/revisar        prévia do dossiê com "Corrigir" por seção + envio
    [caseId]/protocolo      confirmação com protocolo e próximos passos
    [caseId]/dossie         dossiê enviado, pronto para imprimir/salvar em PDF
components/
  ui/ layout/ brand/ case/ triage/ narrative/ documents/ dossier/
domain/
  case/ triage/ legal-area/ user/
  document/                 regras de arquivos e checklist
  dossier/                  schema e montador determinístico do dossiê
  contract/ piece/ deadline/ tipos das fases F2, F4 e F6
lib/
  repositories/             contratos + implementação mock
  services/                 regras de aplicação (CaseService)
  mocks/                    áreas, perguntas e checklists de documentos (dados de teste)
tests/
  unit/ integration/ e2e/
supabase/                   reservado para a fase F5
```

## Como funcionam os mocks

- Áreas: `lib/mocks/legal-areas.ts`.
- Perguntas: `lib/mocks/triage/<area>.ts`. Cada pergunta define tipo, obrigatoriedade, ajuda,
  opções, restrições (`notFuture`, `min`, `max`, `maxLength`) e condição de exibição (`showIf`).
  A etapa é definida pelo título da seção. Para criar ou alterar perguntas, edite apenas esses
  arquivos: as telas se ajustam sozinhas.
- Como as respostas entram no dossiê: `lib/mocks/triage/dossier-hints.ts` marca, por área, quais
  perguntas são **partes** (`party`), **datas** da linha do tempo (`date`), **valores** (`amount`)
  ou **providências** (`action`). O montador fica em `domain/dossier/builder.ts`.
- Checklist de documentos: `lib/mocks/document-checklists.ts` (por área; `recommended` indica o
  selo "Recomendado"). Regras de arquivo em `domain/document/rules.ts`.
- Dados de casos, respostas e documentos ficam na memória do servidor (`lib/repositories/mock/store.ts`) e
  **são apagados ao reiniciar**. Não use dados reais.

Tipos de pergunta suportados: `text`, `textarea`, `date`, `number`, `currency`, `boolean`,
`single_choice`, `multiple_choice`.

## Variáveis de ambiente

Veja `.env.example`. Principais:

| Variável                | Para quê                                                                       |
| ----------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`          | PostgreSQL (Neon), URL _pooled_. Sem ela, o app usa a memória (só dev/testes). |
| `DATABASE_URL_UNPOOLED` | URL direta, usada só pelas migrações (opcional).                               |
| `ALLOW_MEMORY_STORE=1`  | Permite memória em produção. **Nunca na Vercel.**                              |
| `NEXT_PUBLIC_APP_NAME`  | Nome exibido (vazio usa "Júris Office IA").                                    |
| `INDEXAR_SITE=1`        | Libera indexação das páginas públicas (lida no **build**).                     |
| `TEST_DATABASE_URL`     | PostgreSQL real para `npm run test:pg-real` (opcional).                        |

Nunca commite `.env.local`.

## Banco de dados e testes

- Esquema em `db/migrations/*.sql`; `npm run db:migrate` aplica (idempotente). Na Vercel, o script
  `vercel-build` migra e compila. Sem `DATABASE_URL`, o migrador não faz nada.
- Os dados dos atendimentos (casos, respostas, documentos simulados, dossiês, rascunhos) ficam no
  banco. Áreas, perguntas e checklists continuam no código.
- `npm test` roda dois projetos: **memoria** (unitários + integração) e **postgres** (as mesmas
  suítes de integração contra PostgreSQL em WebAssembly, sem servidor).
- `npm run test:pg-real` roda contra um PostgreSQL de verdade (`TEST_DATABASE_URL`, por exemplo um
  banco local ou uma _branch_ de teste da Neon; **as tabelas são apagadas a cada teste**, use um
  banco descartável). É aqui que o bloqueio de linha é exercitado com conexões paralelas.
- E2E (`npm run test:e2e`) roda sem banco, com `ALLOW_MEMORY_STORE=1`.

## P2 — Autenticação por conta e acesso por perfil

O código da P2 está em uma branch de implementação, com instruções de ativação em [docs/P2-AUTENTICACAO.md](docs/P2-AUTENTICACAO.md). É necessário configurar Neon Auth e aplicar a migração coordenadamente antes de publicar em produção.

## Roadmap

Prioridade: **persistência real e autenticação antes de qualquer dado real, contrato ou IA.**

1. **F5 — Persistência e acesso** (em andamento): ✅ PostgreSQL/Neon, transações, unicidade e
   idempotência; ✅ limite de requisições e limpeza periódica; ✅ CI no GitHub Actions e Dependabot;
   ✅ papel de banco restrito para o app; ✅ CSP com nonce; ⏳ autenticação e papéis (cliente,
   advogado, administrador); isolamento por escritório e atribuição de casos; RLS; armazenamento
   privado de arquivos; auditoria; backups (janela de 6h confirmada, plano atual não permite mais).
2. **F3 (parte) — Portal do advogado**: recebimento dos dossiês e decisão de viabilidade.
3. **F2 — Contrato e financeiro**: honorários, procuração, assinatura eletrônica, parcelas.
4. **F3 — Apoio jurídico com IA**: saída estruturada, sempre revisada pelo advogado.
5. **F4 — Produção de peças**: templates, editor, exportação PDF/DOCX.
6. **F6 — Prazos, alertas e operação**: motor de prazos, alertas, carteira, admin, observabilidade.

## Notas de segurança

- Dados coletados são os mínimos necessários (nome, e-mail, telefone, cidade/UF).
- Logs de erro não registram dados pessoais.
- Textos de privacidade, termos e consentimento são provisórios e precisam de revisão jurídica
  antes de produção, inclusive quanto ao Código de Ética da OAB para captação.
- Cada atendimento só abre no navegador que o criou (vínculo provisório até o login da F5).
- Revisão completa, cabeçalhos HTTP e limitações conhecidas: ver [SECURITY.md](SECURITY.md).

> **Intermitência (E2E) — investigada na Sprint 4.1:** a tela às vezes não trocava depois de salvar
> (cerca de 4,5% das repetições num laço de 110). Hipótese, não provada: o roteador do Next descarta
> um `router.push` chamado logo após o fim de uma ação do servidor. A navegação passou a ser feita
> pelo servidor (`redirect`); depois disso, 0 travamentos em 150 repetições do mesmo laço. Detalhes e
> limites da comparação em [docs/RELATORIO-SPRINT-4.1.md](docs/RELATORIO-SPRINT-4.1.md).

- Futuro: RLS por atribuição de caso, quando houver autenticação (ver SECURITY.md).

## Publicação

O app roda em qualquer Node ≥ 20.9 (`npm run build && npm start`) ou na Vercel, **sempre com
`DATABASE_URL`**: em funções serverless a memória não persiste entre requisições. Passo a passo em
[docs/NEON-VERCEL.md](docs/NEON-VERCEL.md). Verificação: `GET /api/saude`.

## Limitações atuais

- Sem autenticação: o atendimento é ligado ao navegador por cookie (limpar cookies impede a retomada).
- Arquivos simulados: só nome, tipo e tamanho são registrados.
- Nenhuma informação é encaminhada a advogados; não há portal, contrato nem IA nesta versão.
- Limite de requisições e limpeza periódica implementados (ver SECURITY.md); backups ainda não
  documentados. Use apenas dados fictícios.
