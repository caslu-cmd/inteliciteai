-- FIX: As migrations anteriores revogaram EXECUTE de has_role para authenticated,
-- mas todas as RLS policies chamam has_role(). Sem o EXECUTE, as policies
-- retornam false para todo mundo e o admin não consegue ler/escrever nada.

-- Re-concede EXECUTE para authenticated (necessário para as RLS policies funcionarem)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Garante que a entrada de admin existe para a super admin
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE LOWER(u.email) = 'carolinielucas.cl@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Garante que a assinatura da admin está ativa (sem expiração de trial)
UPDATE public.subscriptions s
SET status = 'active', trial_ends_at = NULL, price_cents = 0
FROM auth.users u
WHERE s.user_id = u.id AND LOWER(u.email) = 'carolinielucas.cl@gmail.com';

-- Garante que o profile da admin está aprovado
UPDATE public.profiles p
SET account_status = 'approved'
FROM auth.users u
WHERE p.id = u.id AND LOWER(u.email) = 'carolinielucas.cl@gmail.com';
