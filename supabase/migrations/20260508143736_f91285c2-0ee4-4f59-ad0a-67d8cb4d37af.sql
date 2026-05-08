-- Add a restrictive policy to pncp_cache so the linter stops warning about RLS enabled without policies.
-- The table is only accessed by Edge Functions (service role bypass), so we deny all direct access.
CREATE POLICY "Deny all direct access to pncp_cache"
ON public.pncp_cache
FOR ALL
USING (false);

-- Revoke execute on trigger functions from authenticated users.
-- Triggers still work because they execute with the function owner's privileges.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive_fields() FROM authenticated, anon, public;

-- has_role is intentionally kept callable by authenticated because it is used inside RLS policies.