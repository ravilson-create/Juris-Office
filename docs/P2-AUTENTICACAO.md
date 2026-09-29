# P2 — Autenticação e acesso por perfil

## O que entrou no código

- Neon Auth (Managed Better Auth): cadastro, login, saída e sessão validada no servidor.
- Casos novos pertencem ao identificador da conta. O acesso de cidadão é verificado nas Server Actions e no PostgreSQL.
- Migração `0003_p2_auth_rls.sql`: perfis (`citizen`, `lawyer`, `admin`), escritório, atribuições, auditoria e RLS em casos, respostas, documentos simulados, dossiês e rascunhos.
- `/equipe`: administrador vê casos do seu escritório e atribui advogados com assinatura ativa; advogado vê apenas casos atribuídos durante a vigência da assinatura. O dossiê da equipe é somente leitura.
- A primeira conta administradora é vinculada exclusivamente ao `JURIS_ADMIN_EMAIL` configurado no servidor, depois da verificação do e-mail. Não depende da ordem de cadastro.
- `lawyer_subscriptions` registra o direito de acesso. Assinaturas vencidas ou canceladas retiram o acesso imediatamente; a cobrança ainda exige um provedor de pagamentos e webhook confiável.
- Casos anteriores sem conta podem ser vinculados no primeiro login a partir do cookie original do mesmo navegador. Não há reivindicação por número de protocolo.
- Testes de isolamento entre cidadãos, advogados e escritórios, além da suíte existente.

## Preparar Neon antes de publicar esta branch

1. Habilite **Managed Better Auth** no mesmo branch Neon do banco. Ative o método e-mail/senha e configure o domínio de produção na lista de trusted domains. Obtenha a Auth URL da configuração desse branch.
2. Defina na Vercel `NEON_AUTH_BASE_URL` e `NEON_AUTH_COOKIE_SECRET` (segredo aleatório de ao menos 32 caracteres) para o ambiente correspondente. Não copie a URL ou o segredo para o repositório. Configure também `DATABASE_URL_UNPOOLED` para migrações, `DATABASE_URL` e `APP_DATABASE_URL` para o papel restrito.
3. Execute a migração num branch de teste com os dados clonados, definindo `ENABLE_P2_AUTH_MIGRATION=1` no build. Sem esta chave o migrador deixa as migrações P2 pendentes, preservando a versão anterior. A migração habilita RLS e bloqueará o app antigo sem sessão: a publicação do código e as variáveis devem ser coordenadas. Faça o deploy de preview e teste cadastro, login, criação, retomada em outro navegador, acesso cruzado, equipe e saída antes do deploy de produção.
4. Defina `JURIS_ADMIN_EMAIL` com o e-mail que você usará. Cadastre essa conta e confirme o e-mail. Ao visitar `/atendimento`, o app criará o perfil e promoverá apenas essa conta a administradora se ainda não houver administrador. A ordem de cadastro não confere privilégio. Se o e-mail não estiver verificado ou a variável não estiver configurada, ninguém é promovido automaticamente.
5. As contas de advogados começam como `citizen`. A promoção a `lawyer` e a gravação de `lawyer_subscriptions` só devem acontecer depois da confirmação de pagamento pelo provedor, usando a conexão administrativa. Nenhum formulário público pode definir papel ou ativar assinatura.

## Limites desta entrega

- Arquivos continuam simulados; conteúdo de arquivos não é transmitido nem armazenado.
- A cobrança, preços, checkout e webhook do provedor ainda não foram definidos. Até sua integração, `/assinatura` informa que não cobra e nenhum advogado ganha acesso pago automaticamente.
- A interface de equipe recebe o dossiê, sem fluxo de decisão, notas ou complementação. Esses fluxos pertencem ao portal do advogado posterior.
- A operação real não foi validada nesta sessão contra o projeto Neon e o domínio Vercel: não havia projeto/branch/credenciais selecionados no ambiente de execução. Os testes locais usam PostgreSQL em WebAssembly e a suíte existente.
- Os casos antigos só podem ser vinculados por quem ainda possui o cookie do navegador original. Casos sem esse cookie exigem reconciliação administrativa fora do produto.
