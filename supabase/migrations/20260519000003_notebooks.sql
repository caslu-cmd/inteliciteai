-- Notebooks: cada usuário pode ter múltiplos notebooks independentes
CREATE TABLE IF NOT EXISTS public.notebooks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Notebook sem título',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notebooks_own" ON public.notebooks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Link sources to a specific notebook
ALTER TABLE public.notebook_sources
  ADD COLUMN IF NOT EXISTS notebook_id UUID REFERENCES public.notebooks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_nb_sources_nb_id ON public.notebook_sources(notebook_id);

-- Persistent chat messages per notebook
CREATE TABLE IF NOT EXISTS public.notebook_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID        NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notebook_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notebook_messages_own" ON public.notebook_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nb_messages_nb_id ON public.notebook_messages(notebook_id);
