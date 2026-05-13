-- Notebook sources: knowledge base documents saved by agente público
CREATE TABLE IF NOT EXISTS public.notebook_sources (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT '',
  content    TEXT        NOT NULL DEFAULT '',
  type       TEXT        NOT NULL CHECK (type IN ('text', 'pdf', 'url', 'search')),
  active     BOOLEAN     NOT NULL DEFAULT true,
  char_count INTEGER     NOT NULL DEFAULT 0,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notebook_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notebook_sources_own" ON public.notebook_sources
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
