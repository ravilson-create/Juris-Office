# Financeiro do escritório

O Portal do Advogado oferece `/equipe/financeiro` para controle exclusivamente manual.
Não chama APIs de cobrança, não gera Pix ou boletos e não altera a assinatura da plataforma.

## Operação

- Lance honorários, receitas, despesas, repasses e acertos, com cliente/favorecido e vínculo
  opcional ao atendimento/processo existente. O modelo atual guarda o cliente em `legal_cases.applicant`;
  não foi criado um segundo cadastro de clientes.
- Um valor total pode ser distribuído em até 120 parcelas mensais. Centavos são distribuídos
  exatamente; vencimentos como 31/01 mantêm o dia original nos meses seguintes.
- Baixas parciais ou totais recebem valor, data efetiva e observação. Não aceitam data futura,
  valor superior ao saldo nem conta cancelada. Um lock de linha serializa baixas/cancelamentos.
- Histórico de baixas, autor e eventos de auditoria são preservados. Contas sem baixa podem ser
  canceladas pelo administrador ou advogado criador. Registros com baixa são imutáveis: correções
  financeiras são novos acertos manuais com justificativa, preservando o histórico.
- Dashboard e relatório de contas respeitam filtros de vencimento, categoria, movimento,
  situação e atendimento. Caixa usa data efetiva para realizado e vencimento para previsto;
  considera todos os registros permitidos no período, independentemente dos outros filtros.
  Não representa saldo bancário e não pressupõe saldo inicial.
- CSV exporta todos os registros do filtro até 10.000; acima disso solicita reduzir o período.
  Há impressão/PDF pela função do navegador. CSV neutraliza fórmulas em textos fornecidos pelo usuário.
- Parcelas de contratos existentes podem ser trazidas expressamente uma única vez. O lançamento
  financeiro é um registro próprio: não altera valores, assinatura ou status das parcelas no contrato.
  Parcelas antigas já pagas não recebem data fictícia; registre manualmente a data efetiva conhecida.
  A seleção lista até 500 atendimentos e 200 parcelas pendentes mais próximas.

## Acesso e persistência

Mantidos PostgreSQL/Neon, Neon Auth, MFA e assinatura por escritório, conforme confirmação do usuário.
Nenhum projeto Supabase foi modificado. O papel de execução continua sendo `juris_app`, sem BYPASSRLS.

`financial_entries` e `financial_settlements` têm RLS. Admin/administrativo veem o próprio escritório;
advogado vê registros sem caso criados por ele e os de casos aos quais já tem acesso. Clientes,
outra organização e escritório sem assinatura (salvo exceção interna já existente) não leem dados,
histórico ou totais. Ações e downloads revalidam sessão, perfil, assinatura e MFA.
Valores e vínculos são imutáveis; não há DELETE concedido. Não há função nova SECURITY DEFINER.

## Implantação

1. Validar em ambiente isolado com as migrações existentes. Para banco real descartável,
   configurar `TEST_DATABASE_URL` e usar as verificações PostgreSQL do repositório.
2. Aplicar `0036_financeiro_manual.sql` pelo migrador existente com a ativação
   `ENABLE_P2_AUTH_MIGRATION=1`, antes de liberar a nova página.
3. `0037_especialidades_advogados_cadastrados.sql` associa todos os perfis existentes de advogado
   e administradores com OAB às cinco áreas ativas. É pontual e idempotente: não promove papéis,
   não confirma OAB e não muda assinaturas. A lista é confrontada com o catálogo ativo nos testes.
4. Publicar o aplicativo e validar login real, baixas parciais, CSV e restrição entre escritórios.

O ajuste de especialidades foi executado no banco real em 17/10/2026: quatro perfis profissionais
com cinco áreas cada, mantendo dois `lawyer` e dois `admin`. A migração posterior não duplica linhas.
O módulo financeiro ainda depende da aplicação de sua migração e publicação do código.

## Verificação e limites desta execução

- Testes cobrem centavos, calendário, validação, CSV, interface, importação idempotente,
  perfis, escritório, assinatura, imutabilidade, histórico e caixa.
- O projeto Neon atingiu o limite de branches; não foi possível criar uma cópia para testes.
  Migrações e RLS foram exercitadas em PostgreSQL local via PGlite.
- O build padrão local compila mas encontra `spawn EPERM` ao executar subprocessos.
  Build completo validado com adaptação temporária de execução por threads e verificação
  TypeScript via API; configuração original restaurada, sem mudanças de build no PR.
- A suíte local usa uma adaptação fora do repositório apenas para a descoberta opcional
  de unidades de rede do Vite, indisponível nesta estação Windows.
- Login real e concorrência entre conexões PostgreSQL reais não foram simulados como validados.
- Resultado local: 15 testes específicos passaram. A suíte geral encontrou uma falha em
  `tests/unit/google-search-console.test.ts`, também reproduzida no GitHub/Linux. Corrigido o caminho
  usado pelo teste para ler o arquivo de verificação diretamente do disco, evitando a transformação
  de URL de asset pelo Vite/jsdom. O conteúdo público não foi modificado.
  Lint sem erros (três avisos já existentes de React Hook Form); TypeScript aprovado.
- A prévia automática Vercel falhou antes do build com `Resource provisioning failed`;
  a criação manual de branch Neon também falhou por limite de branches. Não foi alterado o plano
  nem removido ambiente existente para contornar o limite.
