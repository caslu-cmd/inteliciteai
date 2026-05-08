-- Revoke default PUBLIC execute so only postgres/superuser and service role can call cleanup
REVOKE EXECUTE ON FUNCTION public.cleanup_pncp_cache() FROM PUBLIC;