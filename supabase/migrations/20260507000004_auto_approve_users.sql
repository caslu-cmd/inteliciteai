-- Remove pending gate: all new users are auto-approved on signup.
-- Admin still sees and manages all users, but signup no longer blocks access.

-- Update handle_new_user: everyone starts as 'approved' (in trial)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
  v_platform_role  TEXT;
  v_sub_status     subscription_status;
BEGIN
  v_is_super_admin := LOWER(NEW.email) = 'carolinielucas.cl@gmail.com';
  v_platform_role  := COALESCE(NEW.raw_user_meta_data->>'role', 'gestor');
  v_sub_status     := CASE WHEN v_is_super_admin THEN 'active'::subscription_status ELSE 'trial'::subscription_status END;

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
    email         = EXCLUDED.email,
    full_name     = EXCLUDED.full_name,
    organization  = EXCLUDED.organization,
    account_status = 'approved',
    platform_role  = EXCLUDED.platform_role;

  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_super_admin THEN 'admin'::app_role ELSE 'user'::app_role END);

  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at, price_cents)
  VALUES (
    NEW.id,
    'gratuito',
    v_sub_status,
    CASE WHEN v_is_super_admin THEN NULL ELSE now() + interval '7 days' END,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Approve all existing pending users
UPDATE public.profiles
SET account_status = 'approved'
WHERE account_status = 'pending';
