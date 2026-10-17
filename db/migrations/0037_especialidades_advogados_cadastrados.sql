-- Solicitação pontual: todos os advogados atualmente cadastrados, inclusive assinantes com
-- papel admin e OAB, recebem todas as áreas ativas. Não altera perfis, OAB nem assinaturas.
INSERT INTO lawyer_areas(lawyer_id, legal_area_id)
SELECT p.user_id, a.id FROM profiles p CROSS JOIN (VALUES
  ('d6f91251-f2bd-43ec-86ba-3658ebfe85e1'::uuid), -- Consumidor
  ('031cf6dd-c8ad-4969-a09b-a631c4f2a49d'::uuid), -- Trabalhista
  ('20e8c2ed-499e-4f5d-aaff-956515bb7f2d'::uuid), -- Família
  ('5c43de6a-7096-47b4-b9e0-704b72cd78bd'::uuid), -- Previdenciário
  ('ab539909-086c-451b-ac1d-84fb6afa4c65'::uuid) -- Cível
) AS a(id)
WHERE p.role = 'lawyer' OR (p.role = 'admin' AND p.oab_numero IS NOT NULL)
ON CONFLICT (lawyer_id, legal_area_id) DO NOTHING;
