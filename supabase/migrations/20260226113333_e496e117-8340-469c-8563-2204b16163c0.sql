CREATE POLICY "Require authentication for profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);