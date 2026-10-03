-- Três peças faltando no contrato de honorários (migrações 0011/0012): (1) o contrato só tinha
-- tipo/valor de honorário, sem nenhuma cláusula nem qualificação das partes — agora carrega um
-- retrato completo em `content`, usado para gerar o texto do contrato (ver
-- lib/contracts/clausulas.ts); (2) só o cliente assinava — o advogado só "enviava" por uma
-- troca de status direta, sem deixar rastro de que ele próprio assinou como responsável; (3) não
-- havia visão alguma, nem para o admin do escritório, de todas as assinaturas já efetivadas na
-- plataforma inteira — só por caso/escritório.

-- `content` é gravado uma única vez, na criação (sempre em 'draft') — mudanças posteriores no
-- cadastro do advogado/escritório não alteram um contrato já redigido. DEFAULT só para não quebrar
-- a coluna NOT NULL em bases já existentes; todo INSERT novo (criarContrato) sempre preenche.
ALTER TABLE contracts ADD COLUMN content jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Antes só existia a assinatura do cliente (signed_by/signed_by_hash, nunca os dois). Agora o
-- advogado também assina — ao enviar o contrato (draft -> sent), não depois —, autenticado pela
-- própria conta (login), por isso sem CPF redigitado. signer_cpf é o CPF que o cliente redigita no
-- instante da assinatura (nunca pré-preenchido pela tela) como segundo dado de confirmação além do
-- clique, conferido pela aplicação contra legal_cases.applicant.cpf antes de chamar este INSERT —
-- a própria coluna é só o registro de auditoria dessa conferência, não a autorização em si (a RLS
-- abaixo continua sendo isso).
ALTER TABLE contract_signatures ADD COLUMN signer_role text NOT NULL DEFAULT 'client'
  CHECK (signer_role IN ('lawyer', 'client'));
ALTER TABLE contract_signatures ADD COLUMN signer_cpf text
  CHECK (signer_cpf IS NULL OR signer_cpf ~ '^[0-9]{11}$');

-- Segunda política de INSERT em contract_signatures (permissivas se somam, nunca substituem a
-- signatures_insert da migração 0012): o próprio advogado/admin do caso grava a própria assinatura,
-- e só enquanto o contrato ainda está 'draft' — depois de 'sent', só a trilha do cliente é válida.
CREATE POLICY signatures_insert_lawyer ON contract_signatures FOR INSERT WITH CHECK (
  signer_role = 'lawyer' AND signed_by = app_actor_id() AND EXISTS (
    SELECT 1 FROM contracts c WHERE c.id = contract_signatures.contract_id
      AND actor_role() IN ('lawyer', 'admin') AND can_read_case(c.case_id) AND c.status = 'draft'
  )
);

-- Aba "Assinaturas" do administrador do aplicativo (não do escritório): quem está logado com o
-- e-mail de JURIS_ADMIN_EMAIL (ver lib/auth/bootstrap-admin.ts) já tem profiles.role = 'admin',
-- mas a RLS normal de admin (actor_office_id() = escritório do caso) só mostra o próprio
-- escritório. Essa visão é deliberadamente diferente — todos os escritórios da plataforma — por
-- isso não é mais uma política de RLS: lib/services/equipe-contratos.ts#listarAssinaturasAtivas é
-- chamada com getMaintenanceDb() (ignora RLS), e o app só expõe isso a quem bate o e-mail do dono
-- do aplicativo (checagem na própria página, nunca no banco).
