-- O cadastro administrativo atesta a conta de equipe; a confirmação continua
-- obrigatória para cadastros públicos. Só o evento de cadastro direto, emitido
-- dentro da transação autorizada, libera a identidade correspondente.
CREATE OR REPLACE FUNCTION confirmar_conta_equipe_cadastrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE alvo text;
BEGIN
  IF NEW.action NOT LIKE 'cadastrar_membro_equipe_direto:%' THEN RETURN NEW; END IF;
  alvo := substring(NEW.action FROM length('cadastrar_membro_equipe_direto:') + 1);
  IF NEW.actor_id IS DISTINCT FROM app_actor_id() OR NOT EXISTS (
    SELECT 1 FROM public.profiles admin JOIN public.profiles membro
      ON membro.office_id = admin.office_id
    WHERE admin.user_id = NEW.actor_id AND admin.role = 'admin'
      AND membro.user_id = alvo AND membro.role IN ('lawyer', 'staff')
      AND membro.office_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'cadastro de equipe não autorizado';
  END IF;
  UPDATE neon_auth."user" u SET "emailVerified" = true, "updatedAt" = now()
  FROM public.profiles p
  WHERE p.user_id = alvo AND u.id::text = p.user_id
    AND lower(u.email) = lower(p.email)
    AND EXISTS (SELECT 1 FROM neon_auth.account a
      WHERE a."userId" = u.id AND a."providerId" = 'credential');
  IF NOT FOUND THEN RAISE EXCEPTION 'identidade de equipe não encontrada'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION confirmar_conta_equipe_cadastrada() FROM PUBLIC;

-- CI sem Neon Auth não tem identidades. Em instalações com Neon, o evento
-- confirma a conta na mesma transação do vínculo ao escritório.
DO $$ BEGIN
  IF to_regclass('neon_auth."user"') IS NOT NULL
    AND to_regclass('neon_auth.account') IS NOT NULL THEN
    CREATE TRIGGER confirmar_conta_equipe_apos_cadastro
      AFTER INSERT ON public.audit_logs FOR EACH ROW
      EXECUTE FUNCTION confirmar_conta_equipe_cadastrada();

    -- Repara apenas cadastros diretos documentados, ainda vinculados ao mesmo
    -- escritório do administrador que os criou. Não altera senha nem assinatura.
    UPDATE neon_auth."user" u SET "emailVerified" = true, "updatedAt" = now()
    FROM public.profiles membro
    WHERE membro.user_id = u.id::text AND membro.role IN ('lawyer', 'staff')
      AND lower(membro.email) = lower(u.email) AND NOT u."emailVerified"
      AND EXISTS (
        SELECT 1 FROM public.audit_logs evento JOIN public.profiles admin
          ON admin.user_id = evento.actor_id
        WHERE evento.action = 'cadastrar_membro_equipe_direto:' || membro.user_id
          AND admin.role = 'admin' AND admin.office_id = membro.office_id
          AND membro.office_id IS NOT NULL
      )
      AND EXISTS (SELECT 1 FROM neon_auth.account a
        WHERE a."userId" = u.id AND a."providerId" = 'credential');
  END IF;
END $$;
