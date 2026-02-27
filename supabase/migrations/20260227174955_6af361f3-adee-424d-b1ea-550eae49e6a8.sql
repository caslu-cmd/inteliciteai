
-- Create a view for regular users that excludes ip_address
CREATE OR REPLACE VIEW public.activity_logs_safe AS
SELECT id, user_id, user_email, action, details, created_at
FROM public.activity_logs;

-- Grant access to the view
GRANT SELECT ON public.activity_logs_safe TO authenticated;

-- Drop the existing permissive user policy and recreate with NOT NULL check
DROP POLICY IF EXISTS "Users view own logs" ON public.activity_logs;
CREATE POLICY "Users view own logs" ON public.activity_logs
  FOR SELECT
  USING (user_id IS NOT NULL AND user_id = auth.uid());
