
CREATE TABLE IF NOT EXISTS public.marketplace_projects (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title                TEXT NOT NULL,
    description          TEXT NOT NULL,
    category             TEXT NOT NULL,
    budget_min           INTEGER NOT NULL DEFAULT 0,
    budget_max           INTEGER NOT NULL DEFAULT 0,
    deadline             DATE,
    requirements         TEXT,
    status               TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','contracted','in_progress','delivered','completed','cancelled')),
    selected_application_id UUID,
    platform_fee_pct     INTEGER NOT NULL DEFAULT 20,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS public.project_applications (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID REFERENCES public.marketplace_projects(id) ON DELETE CASCADE NOT NULL,
    consultant_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    proposal         TEXT NOT NULL,
    proposed_value   INTEGER NOT NULL,
    estimated_days   INTEGER NOT NULL DEFAULT 7,
    status           TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','accepted','rejected','withdrawn')),
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, consultant_id)
  );

  CREATE TABLE IF NOT EXISTS public.project_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id       UUID REFERENCES public.marketplace_projects(id) ON DELETE CASCADE NOT NULL,
    application_id   UUID REFERENCES public.project_applications(id),
    sender_id        UUID REFERENCES auth.users(id) NOT NULL,
    content          TEXT NOT NULL,
    created_at       TIMESTAMPTZ DEFAULT now()
  );

  ALTER TABLE public.marketplace_projects    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.project_applications    ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.project_messages        ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone authenticated reads open projects"
    ON public.marketplace_projects FOR SELECT
    USING (auth.uid() IS NOT NULL AND (status = 'open' OR client_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_applications WHERE project_id = marketplace_projects.id AND consultant_id = auth.uid())));

  CREATE POLICY "Clients create projects"
    ON public.marketplace_projects FOR INSERT
    WITH CHECK (client_id = auth.uid());

  CREATE POLICY "Clients update own projects"
    ON public.marketplace_projects FOR UPDATE
    USING (client_id = auth.uid());

  CREATE POLICY "Consultants and clients read applications"
    ON public.project_applications FOR SELECT
    USING (
      consultant_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid())
    );

  CREATE POLICY "Consultants apply to projects"
    ON public.project_applications FOR INSERT
    WITH CHECK (consultant_id = auth.uid());

  CREATE POLICY "Consultants update own applications"
    ON public.project_applications FOR UPDATE
    USING (consultant_id = auth.uid());

  CREATE POLICY "Clients update applications on their projects"
    ON public.project_applications FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid()));

  CREATE POLICY "Project participants read messages"
    ON public.project_messages FOR SELECT
    USING (
      sender_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM public.project_applications WHERE project_id = project_messages.project_id AND consultant_id = auth.uid())
    );

  CREATE POLICY "Project participants send messages"
    ON public.project_messages FOR INSERT
    WITH CHECK (
      sender_id = auth.uid() AND (
        EXISTS (SELECT 1 FROM public.marketplace_projects WHERE id = project_id AND client_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.project_applications WHERE project_id = project_messages.project_id AND consultant_id = auth.uid())
      )
    );
