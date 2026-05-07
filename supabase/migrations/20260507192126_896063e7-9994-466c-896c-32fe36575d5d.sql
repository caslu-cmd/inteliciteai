
-- Explicit admin-only INSERT on payments (defense in depth)
DROP POLICY IF EXISTS "Only admins can insert payments" ON public.payments;
CREATE POLICY "Only admins can insert payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Activity logs: ensure user_email matches the authenticated user
DROP POLICY IF EXISTS "Users insert own logs" ON public.activity_logs;
CREATE POLICY "Users insert own logs"
ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    user_email IS NULL
    OR user_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Coupons: hide usage statistics from regular users
REVOKE SELECT ON public.coupons FROM anon, authenticated;
GRANT SELECT (id, code, discount_percent, valid_until, active) ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
