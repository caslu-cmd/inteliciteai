-- Fix 1: Set immutable search_path on cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_pncp_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pncp_cache WHERE created_at < now() - interval '2 hours';
END;
$$;

-- Fix 2: Enable RLS on pncp_cache so no unprivileged user can read/write directly
ALTER TABLE public.pncp_cache ENABLE ROW LEVEL SECURITY;

-- No policies needed: service role bypasses RLS, and we intentionally block all regular users

-- Fix 3: Prevent authenticated users from executing the cleanup function directly
REVOKE EXECUTE ON FUNCTION public.cleanup_pncp_cache() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_pncp_cache() FROM anon;