-- Corrige contas cadastradas antes da migração 0031 (quando o advogado que assinava nascia
-- 'lawyer', não 'admin'): quem tem uma assinatura própria em lawyer_subscriptions mas está num
-- escritório sem nenhum 'admin' nunca mais consegue acessar /equipe, porque
-- office_has_active_subscription só reconhece assinatura de um perfil 'admin' do escritório
-- (migração 0031). Promove retroativamente — mesma regra de start_lawyer_trial, aplicada a quem
-- já existia antes dela.
UPDATE profiles p
SET role = 'admin'
WHERE p.role = 'lawyer'
  AND EXISTS (SELECT 1 FROM lawyer_subscriptions s WHERE s.lawyer_id = p.user_id)
  AND NOT EXISTS (
    SELECT 1 FROM profiles a WHERE a.office_id = p.office_id AND a.role = 'admin'
  );
