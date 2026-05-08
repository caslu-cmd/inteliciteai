-- Cache for PNCP API responses to avoid rate limiting and improve performance

CREATE TABLE IF NOT EXISTS public.pncp_cache (
  cache_key  TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS needed: only Edge Function (service role) writes to this table
-- Reads happen via Edge Function too

-- Auto-clean old cache entries (older than 2 hours)
CREATE OR REPLACE FUNCTION public.cleanup_pncp_cache()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.pncp_cache WHERE created_at < now() - interval '2 hours';
END;
$$;

-- Schedule cleanup every hour (requires pg_cron)
SELECT cron.schedule(
  'pncp-cache-cleanup',
  '0 * * * *',
  'SELECT public.cleanup_pncp_cache()'
);