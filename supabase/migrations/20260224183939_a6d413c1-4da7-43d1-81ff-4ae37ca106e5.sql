
-- Fix overly permissive policy on activity_logs
DROP POLICY IF EXISTS "Admins insert logs" ON public.activity_logs;
CREATE POLICY "Authenticated insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
