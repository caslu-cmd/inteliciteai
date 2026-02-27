
-- Remove user UPDATE on subscriptions (should only be done via backend/admin)
DROP POLICY IF EXISTS "Users update own subscription" ON public.subscriptions;

-- Remove the "Deny anonymous access" RESTRICTIVE policies that conflict with PERMISSIVE ones
-- The PERMISSIVE policies already scope access correctly; RESTRICTIVE false blocks everyone including anon
DROP POLICY IF EXISTS "Deny anonymous access" ON public.profiles;
DROP POLICY IF EXISTS "Deny anonymous access" ON public.payments;
DROP POLICY IF EXISTS "Deny anonymous access" ON public.subscriptions;
DROP POLICY IF EXISTS "Deny anonymous access" ON public.notifications;
DROP POLICY IF EXISTS "Deny anonymous access" ON public.user_roles;
DROP POLICY IF EXISTS "Deny anonymous delete on logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Deny anonymous insert on logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Deny anonymous access" ON public.activity_logs;
