-- Municípios com white label
CREATE TABLE IF NOT EXISTS municipalities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  state         TEXT NOT NULL,
  cnpj          TEXT,
  logo_url      TEXT,
  primary_color TEXT NOT NULL DEFAULT '#C9A84C',
  secondary_color TEXT NOT NULL DEFAULT '#7A5C00',
  favicon_url   TEXT,
  custom_domain TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vincular usuário a município
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES municipalities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_municipality_id ON profiles(municipality_id);

-- Regulamentos municipais (indexados no RAG)
CREATE TABLE IF NOT EXISTS municipality_regulations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'decreto' CHECK (tipo IN ('decreto','lei','portaria','instrucao_normativa','resolucao','outro')),
  numero          TEXT,
  year            INTEGER,
  content         TEXT NOT NULL,
  embedding       vector(1536),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_municipality_regulations_municipality ON municipality_regulations(municipality_id);

-- Habilitar RLS
ALTER TABLE municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipality_regulations ENABLE ROW LEVEL SECURITY;

-- Todos podem ver municípios ativos
CREATE POLICY "Public can view active municipalities"
  ON municipalities FOR SELECT USING (active = true);

-- Admin gerencia municípios
CREATE POLICY "Admin manages municipalities"
  ON municipalities FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin')
  );

-- Usuários do município veem seus regulamentos
CREATE POLICY "Municipality users see regulations"
  ON municipality_regulations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND municipality_id = municipality_regulations.municipality_id
    )
  );

-- Admin gerencia regulamentos
CREATE POLICY "Admin manages regulations"
  ON municipality_regulations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin')
  );
