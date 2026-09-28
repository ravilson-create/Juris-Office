# Relatório — Sprint 4.1 e persistência em PostgreSQL (Neon)

Data: 2026-09-28. Todos os dados de teste são fictícios. Este relatório separa o que foi
**implementado e verificado**, o que é **simulado** e o que é **preparação para fase futura**.

## 1. Problemas: causa, solução e teste

| #   | Problema (reproduzido antes de corrigir)                           | Causa                                                                                                           | Solução                                                                                                                                                                                                         | Testes permanentes                                                                                                             |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 3.1 | Duas finalizações simultâneas geravam dois dossiês, ambos versão 1 | Ler o caso e gravar dossiê e status eram etapas separadas, sem trava                                            | Finalização idempotente; trava por atendimento; caso com **revisão** (controle otimista); dossiê e status gravados **numa só operação atômica** (transação com `FOR UPDATE` e `UNIQUE (caso, versão)` no banco) | `tests/integration/concurrency.test.ts` (memória e PostgreSQL), `tests/postgres/esquema.test.ts` (20 finalizações simultâneas) |
| 3.2 | `1.2.3` virava 123 e `1.2345` virava 12345                         | Sem vírgula, o parser removia todos os pontos                                                                   | Parser estrito em **centavos inteiros** (`domain/triage/money.ts`), limite de R$ 1 bilhão; formatos válidos preservados                                                                                         | `tests/unit/money.test.ts`                                                                                                     |
| 3.3 | Filhos aceitava `1,5`                                              | Sem regra de inteiro                                                                                            | Regra `integer` por pergunta, com mensagem clara; decimais continuam válidos onde couber                                                                                                                        | `tests/unit/triage-rules.test.ts`                                                                                              |
| 3.4 | Término (2020) antes do início (2025) era aceito                   | Sem validação entre campos                                                                                      | Regra `notBefore` (erro no campo de término; datas iguais aceitas); no formulário, corrigir o início revalida o término                                                                                         | `triage-rules.test.ts`, `triage-integrity.test.ts`, E2E das cinco áreas                                                        |
| 3.5 | Respostas de desligamento reapareciam como confirmadas, com 100%   | Só a etapa atual era reavaliada                                                                                 | O caso inteiro é reavaliado: visibilidade em cadeia, respostas ocultas **apagadas**, revalidação com as mesmas regras; progresso, revisão, dossiê e envio usam só respostas válidas; detecção de ciclos         | `triage-rules.test.ts`, `triage-integrity.test.ts`                                                                             |
| 3.6 | Com 19 documentos, dois envios simultâneos geravam 21              | Contar e inserir eram passos separados                                                                          | Inclusão **atômica** com o limite dentro da operação (`FOR UPDATE` no banco)                                                                                                                                    | `concurrency.test.ts`; `esquema.test.ts` (40 simultâneas = exatamente 20); prova de sanidade abaixo                            |
| 3.7 | Envio às 22h de 27/09 aparecia como 28/09 na linha do tempo        | Datas calculadas em UTC                                                                                         | Política central (`domain/time.ts`): instantes em UTC, exibidos em America/Sao_Paulo; datas dos fatos sem conversão; protocolo usa o dia de **criação** em Brasília                                             | `tests/unit/time.test.ts`, `triage-integrity.test.ts`                                                                          |
| I   | Tela às vezes não trocava após salvar (intermitência do README)    | **Hipótese, não provada**: o roteador do Next descarta um `router.push` logo após o fim de uma ação do servidor | Navegação feita pelo servidor (`redirect`) nas ações de identificação, triagem e relato                                                                                                                         | Medição abaixo; E2E                                                                                                            |
| N   | Home com "O faz as perguntas certas"                               | `NEXT_PUBLIC_APP_NAME` vazia na Vercel; `??` não cai no padrão                                                  | `?.trim() \|\|`                                                                                                                                                                                                 | Verificação manual do site publicado (versão antiga)                                                                           |

**Investigação da intermitência** (transição identificação → triagem, perfil Pixel 7, em laço):

| Condição                                                                    | Travamentos      |
| --------------------------------------------------------------------------- | ---------------- |
| Versão da sprint, antes da correção                                         | 5 em 110 (≈4,5%) |
| Pasta de trabalho da Sprint 4 (contém o portal do advogado da outra sessão) | 0 em 110         |
| Versão da sprint com observadores de diagnóstico                            | 0 em 110         |
| **Versão da sprint, depois da correção**                                    | **0 em 150**     |

Limites: a causa não foi provada; o problema sumiu quando adicionei instrumentação (sinal de
corrida sensível a tempo); a base de comparação não é o zip limpo da Sprint 4. Não foram
aumentadas tentativas nem esperas para esconder falhas.

## 2. Outras entregas

- **Comunicação** (seção 4): todas as telas listadas foram revisadas; aviso permanente de ambiente
  de testes; protocolo e dossiê dizem "gerado para demonstração" e que nada foi encaminhado.
- **Meus atendimentos**: lista filtrada **no servidor** pela sessão; retoma na primeira etapa
  pendente; estados vazio, carregando e erro; avisos sobre cookies e reinício. O protocolo não é
  credencial. Visitar a página não cria sessão. Testes: `rascunhos-atendimentos.spec.ts`.
- **Rascunhos**: no servidor (nada no armazenamento do navegador); não concluem etapa; estados
  reais "Salvando / Rascunho salvo / Não foi possível salvar"; uma requisição por vez; rascunho
  atrasado ou de outra aba não sobrescreve gravação mais nova; recusado após a finalização; aviso ao
  sair com alteração pendente. **Limitação**: o aviso ao fechar a aba depende do navegador
  (alguns só o exibem após interação do usuário, e o texto não é personalizável); ele nunca afirma
  que salvou quando não salvou.
- **Neon/PostgreSQL**: esquema, migrador idempotente, cinco repositórios, `/api/saude`, recusa de
  memória em produção. Guia em `docs/NEON-VERCEL.md`.

## 3. Resultados reais dos comandos

| Verificação                                                         | Resultado                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Prettier, ESLint, TypeScript                                        | Sem erros                                                                    |
| Testes unitários + integração                                       | **298 aprovados** (229 na memória + 69 em PostgreSQL/PGlite)                 |
| Mesmas suítes em **PostgreSQL 16 real** (conexões paralelas)        | **69 aprovados**                                                             |
| `npm run vercel-build` (sem `DATABASE_URL`)                         | Aprovado (migrador não faz nada sem banco)                                   |
| Migrador em PostgreSQL 16 real                                      | Aplicou `0001` e foi idempotente na 2ª execução                              |
| `npm audit`                                                         | 0 alertas (não é garantia de segurança completa)                             |
| **E2E com o app gravando em PostgreSQL real**, computador + celular | **52 aprovados** (26 + 26)                                                   |
| Integridade do banco após os E2E                                    | 45 casos, 14 finalizados, 14 dossiês, 0 duplicados, 0 finalizados sem dossiê |

**Prova de sanidade da concorrência**: removido temporariamente o `FOR UPDATE` da inclusão de
documentos, o teste falhou (27 e 30 documentos, acima de 20); restaurado, o total é exatamente 20.

## 4. Como testar (passo a passo)

**Meus atendimentos**

1. Abra o app e toque em **Iniciar atendimento de teste**; escolha uma área e preencha a identificação.
2. Toque em **Meus atendimentos** (menu superior). O atendimento aparece como "Em preenchimento".
3. Toque em **Continuar de onde parou**: você volta à primeira parte pendente.
4. Abra o mesmo endereço em **outro navegador** (ou aba anônima): a lista deve vir vazia.

**Rascunhos**

1. Na tela de relato, digite um texto e espere: aparece "Rascunho salvo".
2. Recarregue a página: o texto volta, com o aviso "Rascunho restaurado". O relato **ainda não** foi salvo oficialmente.
3. Desligue a internet e digite mais: aparece "Não foi possível salvar o rascunho" e o texto permanece.
4. Com texto não salvo, tente fechar a aba: o navegador pergunta antes de sair.

**Finalização**

1. Conclua a triagem, o relato e os documentos simulados; na revisão, toque em **Finalizar atendimento de teste**.
2. Abra o dossiê e o protocolo; em **Meus atendimentos**, o item aparece como "Finalizado (teste)".
3. Tente abrir a edição do atendimento: você é levado ao protocolo (não edita mais).

## 5. Implementado × simulado × preparação

- **Implementado e verificado**: as sete correções; rascunhos; Meus atendimentos; persistência em
  PostgreSQL com restrições e transações; migrador; página de saúde; textos honestos.
- **Simulado**: upload de arquivos (só metadados); dossiê determinístico (sem IA); protocolo de
  demonstração; nada é encaminhado a advogado.
- **Preparação para fase futura (não disponível)**: autenticação e papéis, isolamento por
  escritório, RLS, armazenamento privado, auditoria, retenção/backups, limites de uso, portal do
  advogado, contratos, IA.

## 6. O que NÃO foi verificado

- **Nenhuma conexão real com a Neon**: o código foi testado em PostgreSQL 16 local e em PGlite.
  Diferenças possíveis: latência, pooler (PgBouncer) e certificado TLS. O primeiro deploy deve ser
  conferido em `/api/saude`.
- O **deploy na Vercel** não foi feito nem verificado por mim; o site publicado ainda está na versão
  da Sprint 4.
- Navegadores e aparelhos reais (foi usado Chromium com emulação de celular); Safari/Firefox não.
- O comportamento do aviso ao fechar a aba em cada navegador.
- Carga, limites de requisição, retenção e backups.
