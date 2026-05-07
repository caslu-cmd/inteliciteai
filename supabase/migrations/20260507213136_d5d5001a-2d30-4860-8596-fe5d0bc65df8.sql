GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE LOWER(u.email) = 'carolinielucas.cl@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.subscriptions s
SET status = 'active', trial_ends_at = NULL, price_cents = 0
FROM auth.users u
WHERE s.user_id = u.id AND LOWER(u.email) = 'carolinielucas.cl@gmail.com';

UPDATE public.profiles p
SET account_status = 'approved'
FROM auth.users u
WHERE p.id = u.id AND LOWER(u.email) = 'carolinielucas.cl@gmail.com';