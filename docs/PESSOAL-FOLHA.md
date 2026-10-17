# Pessoal e folha — controle gerencial interno

## Acesso
Portal do Advogado > Financeiro > Pessoal e folha de pagamento. Apenas administradores de
um escritório com assinatura ativa podem consultar ou alterar CPFs, salários e eventos de RH.
O papel restrito `juris_app` aplica RLS no Neon; todas as consultas filtram `office_id`.
Não transformar advogados cadastrados automaticamente em funcionários.

## Funcionalidades
- Cadastro de colaborador com vínculo CLT/estágio/associado/prestador/outro, salário de referência,
  jornada, admissão e situação.
- Folhas mensais, 13º, férias e rescisão como **lançamentos gerenciais manuais**.
- Valores em centavos (inteiros); bruto = base + adicionais; líquido = bruto − descontos;
  custo patronal gerencial = bruto + encargos patronais informados + benefícios custeados.
- Alteração de situação/remuneração de referência preserva snapshots das competências antigas.
- Fechamento irreversível da folha; registro posterior de uma data de pagamento uma única vez.
- Registro de férias, faltas, licenças e afastamentos; sem cálculo legal automático de direitos.
- Histórico e exportação CSV por competência; botão imprimir/salvar PDF pelo navegador.

## Limites e conciliação
Não envia eSocial, não gera guias, não calcula automaticamente alíquotas legais nem efetua
pagamentos. Impostos, INSS, FGTS, IRRF, convenções, jornadas e férias devem ser conferidos pela
contabilidade. A folha **não cria lançamentos automáticos no Financeiro**: o usuário lança
manualmente as obrigações após conciliar, para evitar dupla contagem.

## Migração
`0040_pessoal_folha_manual.sql` no Neon PostgreSQL. Aplicada pelo migrador com
`ENABLE_P2_AUTH_MIGRATION=1`, usando a URL de conexão direta de migrações.
Primeiro validar em uma branch de teste; em produção, o deploy/migration roda de forma
coordenada. Nenhum dado de funcionários preexistente é apagado.

## Segurança
Dados confidenciais; acesso mínimo ao administrador do escritório.
Não enviar CPF nem salários por logs, analytics ou URLs. A auditoria salva identificadores
e tipo de ação. RLS separa escritórios. O CSV usa escaping preventivo de fórmulas.
