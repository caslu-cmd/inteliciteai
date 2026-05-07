
-- Revoke execute on SECURITY DEFINER helper functions from public roles
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_sensitive_fields() FROM anon, authenticated;
