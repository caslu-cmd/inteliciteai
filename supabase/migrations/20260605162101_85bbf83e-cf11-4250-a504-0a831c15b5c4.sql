
CREATE TABLE IF NOT EXISTS public.municipalities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  state           TEXT NOT NULL,
  cnpj            TEXT,
  logo_url        TEXT,
  primary_color   TEXT NOT NULL DEFAULT '#C9A84C',
  secondary_color TEXT NOT NULL DEFAULT '#7A5C00',
  favicon_url     TEXT,
  custom_domain   TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.municipalities TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.municipalities TO authenticated;
GRANT ALL ON public.municipalities TO service_role;

ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active municipalities"
  ON public.municipalities FOR SELECT
  USING (active = true);

CREATE POLICY "Admin manages municipalities"
  ON public.municipalities FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES public.municipalities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_municipality_id ON public.profiles(municipality_id);

CREATE TABLE IF NOT EXISTS public.municipality_regulations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'decreto' CHECK (tipo IN ('decreto','lei','portaria','instrucao_normativa','resolucao','outro')),
  numero          TEXT,
  year            INTEGER,
  content         TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipality_regulations_municipality ON public.municipality_regulations(municipality_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.municipality_regulations TO authenticated;
GRANT ALL ON public.municipality_regulations TO service_role;

ALTER TABLE public.municipality_regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Municipality users see regulations"
  ON public.municipality_regulations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND municipality_id = municipality_regulations.municipality_id
  ));

CREATE POLICY "Admin manages regulations"
  ON public.municipality_regulations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
