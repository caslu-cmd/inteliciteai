-- Block anonymous access on all sensitive tables
CREATE POLICY "Deny anonymous access" ON public.profiles FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anonymous access" ON public.activity_logs FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anonymous access" ON public.payments FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anonymous access" ON public.subscriptions FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anonymous access" ON public.notifications FOR SELECT TO anon USING (false);
CREATE POLICY "Deny anonymous access" ON public.user_roles FOR SELECT TO anon USING (false);

-- Add missing DELETE/INSERT policies

-- Profiles: deny delete for non-admins
CREATE POLICY "Only admins can delete profiles" ON public.profiles FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Subscriptions: only admins can insert/delete
CREATE POLICY "Only admins can insert subscriptions" ON public.subscriptions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can delete subscriptions" ON public.subscriptions FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Payments: only admins can insert
CREATE POLICY "Only admins can insert payments" ON public.payments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Notifications: only admins can insert/delete
CREATE POLICY "Only admins can insert notifications" ON public.notifications FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- Activity logs: make immutable (no update/delete for anyone except via existing policies)
CREATE POLICY "Deny anonymous insert on logs" ON public.activity_logs FOR INSERT TO anon WITH CHECK (false);
CREATE POLICY "Deny anonymous delete on logs" ON public.activity_logs FOR DELETE TO anon USING (false);