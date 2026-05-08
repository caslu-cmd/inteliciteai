-- Minutas: impugnações e pedidos de esclarecimento gerados pela IA

CREATE TABLE IF NOT EXISTS public.minutas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('impugnacao', 'esclarecimento')),
  titulo      TEXT        NOT NULL,
  edital      TEXT        NOT NULL DEFAULT '',
  orgao       TEXT        NOT NULL DEFAULT '',
  clausula    TEXT        NOT NULL DEFAULT '',
  base_legal  TEXT        NOT NULL DEFAULT '',
  conteudo    TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho', 'gerado', 'assinado', 'protocolado')),
  version     INTEGER     NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.minutas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minutas_own" ON public.minutas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER minutas_updated_at
  BEFORE UPDATE ON public.minutas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
