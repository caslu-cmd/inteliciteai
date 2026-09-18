-- Checklists de qualificação (gestor público): progresso salvo por usuário e
-- tipo de contratação (bens/servicos/obras).

CREATE TABLE IF NOT EXISTS public.checklists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('bens', 'servicos', 'obras')),
  checked_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, tipo)
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklists_own" ON public.checklists;
CREATE POLICY "checklists_own" ON public.checklists
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS checklists_updated_at ON public.checklists;
CREATE TRIGGER checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS checklists_user_idx ON public.checklists(user_id);
