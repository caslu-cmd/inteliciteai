
DROP POLICY IF EXISTS "Anyone authenticated reads open projects" ON public.marketplace_projects;

CREATE POLICY "Authenticated reads open or own projects"
ON public.marketplace_projects
FOR SELECT
TO authenticated
USING (
  status = 'open'
  OR client_id = auth.uid()
);
