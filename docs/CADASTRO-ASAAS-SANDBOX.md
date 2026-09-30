# Cadastro profissional e acompanhamento por protocolo

O Júris Office usa contas profissionais próprias com e-mail/senha, hash scrypt e sessões opacas revogáveis de 12 horas. O cadastro não depende de código por e-mail. Contas legadas do Neon Auth são importadas apenas após verificar a senha; o ID e os privilégios previamente concedidos são preservados. O cadastro público nunca concede administração.

O cliente inicia atendimento gratuitamente, sem conta. Ao finalizar recebe o próprio protocolo aleatório, usado em `/consulta` por POST, sem identificador na URL. A consulta retorna situação e mensagens publicadas pelo advogado; não retorna identificação, relato, documentos ou notas internas. Protocolos antigos de sufixo curto não são habilitados para consulta anônima. O cliente deve guardar o protocolo com sigilo; quem possui o número pode consultar o andamento.

O painel `/equipe` requer login. Advogados precisam de assinatura ativa e atribuição do atendimento para acessar o dossiê, notas e atualização de status. O administrador encaminha a solicitação; o protocolo não é exibido na fila administrativa. O banco continua aplicando RLS. A interface preserva a fase de testes e os documentos continuam somente com metadados, sem upload de conteúdo.

## Configuração

- `DATABASE_URL`: conexão administrativa, restrita ao servidor, para contas, sessões, cobrança e consulta limitada por protocolo.
- `APP_DATABASE_URL`: papel `juris_app` sem BYPASSRLS, obrigatório em produção para os atendimentos.
- `DATABASE_URL_UNPOOLED`: migrações, quando disponível.
- `ASAAS_SANDBOX_API_KEY`: chave da conta **sandbox**, cadastrada nas variáveis protegidas da Vercel.
- `ASAAS_SANDBOX_WEBHOOK_TOKEN`: segredo aleatório de pelo menos 32 caracteres, igual ao token configurado no webhook Asaas.

No sandbox Asaas, configure o webhook `https://juris-office-eta.vercel.app/api/webhooks/asaas` com os eventos de pagamentos e assinaturas. A API está fixada em `https://api-sandbox.asaas.com/v3`; não há opção de cobrança de produção nesta entrega. Migrações são aplicadas pelo comando `vercel-build`; a migração 0006 é aditiva.

## Teste do fluxo

1. Criar advogado em `/auth/sign-up`, informar CPF/CNPJ válido para testes, OAB/UF, plano e senha. Nenhum OTP é solicitado.
2. Em `/assinatura`, gerar a cobrança de teste e abrir a fatura sandbox.
3. Simular confirmação do pagamento no sandbox; o webhook ou “Atualizar pagamento” consulta o estado atual no Asaas e libera o período pago.
4. Administrador encaminha um atendimento ao advogado. O advogado acessa `/equipe`, publica andamento e mantém notas internas separadas.
5. Cliente usa o protocolo recebido em `/consulta` e vê o andamento e mensagens públicas.
6. Simular reembolso/cancelamento e verificar revogação ou fim do período pago. Eventos repetidos são idempotentes; eventos antigos consultam o estado atual do gateway.

Preços mantidos do catálogo existente: mensal R$ 39,90; anual R$ 300,00. Sem chave sandbox, cadastro/login continuam funcionando, mas a cobrança fica indisponível e não concede assinatura. Testes automatizados de cobrança usam respostas simuladas; não substituem a confirmação real no sandbox.
