
-- Fix: Set the view to use SECURITY INVOKER (the querying user's permissions)
ALTER VIEW public.activity_logs_safe SET (security_invoker = on);
