# P2 — Autenticação e acesso por perfil

## O que entrou no código

- Neon Auth (Managed Better Auth): cadastro, login, saída e sessão validada no servidor.
- Casos novos pertencem ao identificador da conta. O acesso de cidadão é verificado nas Server Actions e no PostgreSQL.
- Migração `0003_p2_auth_rls.sql`: perfis (`citizen`, `lawyer`, `admin`), escritório, atribuições, auditoria e RLS em casos, respostas, documentos simulados, dossiês e rascunhos.
- `/equipe`: administrador vê casos do seu escritório e atribui advogado do mesmo escritório; advogado vê apenas casos atribuídos. O dossiê da equipe é somente leitura.
- Casos anteriores sem conta podem ser vinculados no primeiro login a partir do cookie original do mesmo navegador. Não há reivindicação por número de protocolo.
- Testes de isolamento entre cidadãos, advogados e escritórios, além da suíte existente.

## Preparar Neon antes de publicar esta branch

1. Habilite **Managed Better Auth** no mesmo branch Neon do banco. Ative o método e-mail/senha e configure o domínio de produção na lista de trusted domains. Obtenha a Auth URL da configuração desse branch.
2. Defina na Vercel `NEON_AUTH_BASE_URL` e `NEON_AUTH_COOKIE_SECRET` (segredo aleatório de ao menos 32 caracteres) para o ambiente correspondente. Não copie a URL ou o segredo para o repositório. Configure também `DATABASE_URL_UNPOOLED` para migrações, `DATABASE_URL` e `APP_DATABASE_URL` para o papel restrito.
3. Execute a migração num branch de teste com os dados clonados, definindo `ENABLE_P2_AUTH_MIGRATION=1` no build. Sem esta chave o migrador deixa `0003_p2_auth_rls.sql` pendente, preservando a versão anterior. A migração habilita RLS e bloqueará o app antigo sem sessão: a publicação do código e as variáveis devem ser coordenadas. Faça o deploy de preview e teste cadastro, login, criação, retomada em outro navegador, acesso cruzado, equipe e saída antes do deploy de produção.
4. Crie uma conta pelo aplicativo. Para promover o primeiro administrador, usando **somente** uma conexão administrativa (nunca `APP_DATABASE_URL`), confira o `user_id` em `neon_auth.user` do mesmo branch e execute, substituindo o identificador verificado:

```sql
UPDATE profiles SET role = 'admin', office_id = '00000000-0000-4000-8000-000000000001'
WHERE user_id = '<id verificado>' AND role = 'citizen';
```

Para um advogado, use `role = 'lawyer'` e o mesmo `office_id`. A conta deve ter visitado `/atendimento` para criar seu perfil antes da promoção. Nunca aceite papel ou escritório enviados pelo navegador. Não compartilhe credenciais de banco com o cliente.

## Limites desta entrega

- Arquivos continuam simulados; conteúdo de arquivos não é transmitido nem armazenado.
- A interface de equipe recebe o dossiê, sem fluxo de decisão, notas ou complementação. Esses fluxos pertencem ao portal do advogado posterior.
- A operação real não foi validada nesta sessão contra o projeto Neon e o domínio Vercel: não havia projeto/branch/credenciais selecionados no ambiente de execução. Os testes locais usam PostgreSQL em WebAssembly e a suíte existente.
- Os casos antigos só podem ser vinculados por quem ainda possui o cookie do navegador original. Casos sem esse cookie exigem reconciliação administrativa fora do produto.
