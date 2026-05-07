
-- Add account_status and platform_role to profiles (required by application code)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (account_status IN ('pending', 'approved', 'rejected', 'free')),
  ADD COLUMN IF NOT EXISTS platform_role TEXT NOT NULL DEFAULT 'gestor'
    CHECK (platform_role IN ('gestor', 'licitante', 'consultor'));

-- Update handle_new_user to include these columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super_admin BOOLEAN;
  v_platform_role  TEXT;
  v_acct_status    TEXT;
  v_sub_status     subscription_status;
BEGIN
  v_is_super_admin := LOWER(NEW.email) = 'carolinielucas.cl@gmail.com';
  v_platform_role  := COALESCE(NEW.raw_user_meta_data->>'role', 'gestor');
  v_acct_status    := CASE WHEN v_is_super_admin THEN 'approved' ELSE 'pending' END;
  v_sub_status     := CASE WHEN v_is_super_admin THEN 'active'::subscription_status ELSE 'trial'::subscription_status END;

  INSERT INTO public.profiles (id, email, full_name, organization, account_status, platform_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'organization', ''),
    v_acct_status,
    v_platform_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email          = EXCLUDED.email,
    full_name      = EXCLUDED.full_name,
    organization   = EXCLUDED.organization,
    account_status = EXCLUDED.account_status,
    platform_role    = EXCLUDED.platform_role;

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

-- Guard trigger for sensitive profile fields
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.account_status := OLD.account_status;
  NEW.platform_role  := OLD.platform_role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_fields ON public.profiles;
CREATE TRIGGER guard_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_fields();

-- Grandfather existing users
UPDATE public.profiles p
SET account_status = 'approved'
FROM auth.users u
WHERE p.id = u.id
  AND p.account_status = 'pending'
  AND LOWER(u.email) <> 'carolinielucas.cl@gmail.com';

UPDATE public.profiles p
SET account_status = 'approved'
FROM auth.users u
WHERE p.id = u.id AND LOWER(u.email) = 'carolinielucas.cl@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'
FROM auth.users u
WHERE LOWER(u.email) = 'carolinielucas.cl@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.subscriptions s
SET status = 'active', trial_ends_at = NULL
FROM auth.users u
WHERE s.user_id = u.id AND LOWER(u.email) = 'carolinielucas.cl@gmail.com';
