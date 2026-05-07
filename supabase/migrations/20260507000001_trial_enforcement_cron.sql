-- Enable pg_cron (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function that marks expired trials as 'expired'
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE status = 'trial'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < NOW();
END;
$$;

-- Remove existing schedule if it exists, then re-create
SELECT cron.unschedule('expire-trials-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-trials-daily'
);

SELECT cron.schedule(
  'expire-trials-daily',
  '0 3 * * *',
  $$SELECT public.expire_trials()$$
);

-- Run once immediately to catch any already-expired trials
SELECT public.expire_trials();
