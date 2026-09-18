-- Correção: o trigger de criação de perfil no signup precisa rodar como owner
-- (SECURITY DEFINER) para inserir em profiles/user_roles/subscriptions sem
-- esbarrar no RLS dessas tabelas. Sem isso, o cadastro falha com
-- "Database error saving new user".
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_privileged BOOLEAN;
  v_platform_role TEXT;
  v_sub_status    subscription_status;
BEGIN
  v_is_privileged := LOWER(NEW.email) IN (
    'carolinielucas.cl@gmail.com',
    'inteliciteoficial@gmail.com'
  );
  v_platform_role := COALESCE(NEW.raw_user_meta_data->>'role', 'gestor');
  v_sub_status    := CASE WHEN v_is_privileged THEN 'active'::subscription_status ELSE 'trial'::subscription_status END;

  INSERT INTO public.profiles (id, email, full_name, organization, account_status, platform_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'organization', ''),
    'approved',
    v_platform_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email          = EXCLUDED.email,
    full_name      = EXCLUDED.full_name,
    organization   = EXCLUDED.organization,
    account_status = 'approved',
    platform_role  = EXCLUDED.platform_role;

  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_privileged THEN 'admin'::app_role ELSE 'user'::app_role END);

  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at, price_cents)
  VALUES (
    NEW.id, 'gratuito', v_sub_status,
    CASE WHEN v_is_privileged THEN NULL ELSE now() + interval '7 days' END,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
