# Publicar na Vercel com banco Neon

Passo a passo para trocar o armazenamento em memória pelo PostgreSQL da Neon. Tudo pode ser feito
pelo navegador do celular. **Nunca cole a senha do banco em chats, e-mails ou no código.**

## 1. Criar o banco (uma vez)

1. Na Vercel, abra o projeto **juris-office** → aba **Storage** (ou **Integrations**) → **Neon**.
2. Crie um banco **novo e dedicado** ao Júris Office. **Não reutilize** os projetos existentes da
   sua conta Neon (`neon-analisador`, `neon-fiscal-sinapi`, `neon-leiturinha`, `sismanut-mpma`,
   `fiscal-db`): eles são de outros sistemas.
3. Região: prefira **São Paulo (aws-sa-east-1)**, a mesma da maioria dos seus projetos.
4. Conecte o banco ao projeto, marcando os ambientes **Production** e **Preview**. A integração
   cria as variáveis `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` sozinha.

## 2. Conferir as variáveis (Settings → Environment Variables)

- `DATABASE_URL` existe (criada pela integração).
- `NEXT_PUBLIC_APP_NAME`: se estiver **vazia**, apague-a ou preencha com `Júris Office IA`.
  (Vazia, ela fazia a frase da home aparecer como "O faz as perguntas certas".)
- **Não** defina `ALLOW_MEMORY_STORE`.
- Em **Settings → Build & Development**, deixe o _Build Command_ **sem override**: a Vercel usa o
  script `vercel-build`, que aplica as migrações do banco e depois compila o app.

## 3. Publicar

1. Envie este pacote para o repositório (substituindo os arquivos) e faça o commit.
2. A Vercel faz o deploy. No log do build deve aparecer `[migrate] aplicada: 0001_atendimentos.sql`
   (no primeiro deploy) e `[migrate] ok`.
3. Abra `https://juris-office-eta.vercel.app/api/saude`. O esperado é:
   `{"status":"ok","banco":"postgresql"}`.
   - `{"status":"sem_banco"}` → `DATABASE_URL` não chegou ao ambiente de produção.
   - `{"status":"indisponivel"}` → o banco não respondeu; veja o log da função e o painel da Neon.
4. Faça um atendimento de teste completo e confira em **Meus atendimentos**. Como os dados agora
   estão no banco, eles sobrevivem a novos deploys e a reinícios.

## 3.1. Papel de banco restrito para o app (P1)

Por padrão, a integração Neon-Vercel preenche `DATABASE_URL`/`DATABASE_URL_UNPOOLED` com o papel
**dono** do banco (`neondb_owner`), que pode criar e apagar tabelas. Isso é necessário para as
migrações, mas não para o app rodando em produção — se um único segredo vazar, o ideal é que ele
não sirva para apagar o esquema inteiro.

Foi criado um papel `juris_app`, só com `SELECT`/`INSERT`/`UPDATE`/`DELETE` nas tabelas do app
(sem `CREATE`/`ALTER`/`DROP`), com `ALTER DEFAULT PRIVILEGES` garantindo que tabelas criadas por
migrações futuras já nasçam com essa concessão. A conexão desse papel fica na variável
`APP_DATABASE_URL` (não gerenciada pela integração — criada manualmente, para não conflitar com a
sincronização automática do `DATABASE_URL`).

- `lib/db/connection.ts` usa `APP_DATABASE_URL` quando ela existe, e cai em `DATABASE_URL` quando
  não existe (nada muda em ambientes sem essa variável, como testes e desenvolvimento local).
- `DATABASE_URL`/`DATABASE_URL_UNPOOLED` continuam sendo usadas só pelo migrador
  (`scripts/migrate.mjs`), que precisa do papel dono para aplicar `CREATE TABLE`/`ALTER TABLE`.
- **Limitação conhecida da Neon**: papéis criados pela Neon vêm com `CREATEDB`/`CREATEROLE`
  habilitados, e isso **não pode ser revogado por SQL** (`ALTER ROLE ... NOCREATEDB` dá "permission
  denied") nesse plano. Ou seja, `juris_app` não pode alterar o esquema das tabelas existentes,
  mas em teoria poderia criar um banco ou papel novo dentro do mesmo projeto Neon — um risco menor
  que vazar o papel dono, mas não zero. Reavaliar se a Neon passar a permitir revogar isso, ou ao
  avaliar upgrade de plano.

## 4. Cuidados

- **Preview deployments** usam as variáveis de Preview. Se apontarem para o mesmo banco da
  produção, testes de branches gravam dados no banco de produção. Prefira uma _branch_ da Neon por
  preview (a integração oferece essa opção).
- O banco guarda o que as pessoas digitam. **Use apenas dados fictícios** enquanto não houver
  autenticação, política de retenção e revisão jurídica (ver SECURITY.md).
- As migrações são apenas aditivas; para desfazer um deploy, use _Promote_ da versão anterior.
- Índices para buscadores: o site é bloqueado por padrão. `INDEXAR_SITE=1` (definida **antes** do
  build) libera só as páginas públicas.
