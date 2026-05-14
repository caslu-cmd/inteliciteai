-- Permite projetos demo sem client_id (projetos seed/fictícios)
ALTER TABLE public.marketplace_projects ALTER COLUMN client_id DROP NOT NULL;

-- Atualiza política de leitura para incluir projetos com client_id nulo
DROP POLICY IF EXISTS "Anyone authenticated reads open projects" ON public.marketplace_projects;
CREATE POLICY "Anyone authenticated reads open projects"
  ON public.marketplace_projects FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      status = 'open'
      OR client_id IS NULL
      OR client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.project_applications
        WHERE project_id = marketplace_projects.id
          AND consultant_id = auth.uid()
      )
    )
  );
