-- Diagnósticos de modalidade (gestor público): histórico dos diagnósticos
-- gerados na tela de Diagnóstico de Licitação.

CREATE TABLE IF NOT EXISTS public.diagnosticos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_estimado NUMERIC     NOT NULL DEFAULT 0,
  urgencia       TEXT        NOT NULL DEFAULT '',
  tipo_objeto    TEXT        NOT NULL DEFAULT '',
  modalidade     TEXT        NOT NULL DEFAULT '',
  fundamento     TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diagnosticos_own" ON public.diagnosticos;
CREATE POLICY "diagnosticos_own" ON public.diagnosticos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS diagnosticos_user_idx ON public.diagnosticos(user_id);
