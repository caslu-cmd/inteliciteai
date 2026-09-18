-- Contratos: gestão dos contratos do próprio licitante (não confundir com
-- contratos-vencendo, que consulta o PNCP para radar de concorrentes).

CREATE TABLE IF NOT EXISTS public.contratos (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero             TEXT        NOT NULL DEFAULT '',
  titulo             TEXT        NOT NULL,
  orgao              TEXT        NOT NULL DEFAULT '',
  valor              NUMERIC     NOT NULL DEFAULT 0,
  data_inicio        DATE,
  data_fim           DATE,
  progresso          INTEGER     NOT NULL DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  proximo_marco      TEXT        NOT NULL DEFAULT '',
  proxima_data       TEXT        NOT NULL DEFAULT '',
  aditivos_pendentes INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_own" ON public.contratos;
CREATE POLICY "contratos_own" ON public.contratos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS contratos_updated_at ON public.contratos;
CREATE TRIGGER contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS contratos_user_idx ON public.contratos(user_id);
