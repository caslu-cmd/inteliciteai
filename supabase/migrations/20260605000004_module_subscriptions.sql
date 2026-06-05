-- Módulos da plataforma com gating por usuário
CREATE TABLE IF NOT EXISTS module_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module          TEXT NOT NULL CHECK (module IN ('analise','consulta','conformidade')),
  active          BOOLEAN NOT NULL DEFAULT false,
  price_cents     INTEGER NOT NULL DEFAULT 0,
  unlocked_at     TIMESTAMPTZ,
  next_billing_at TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  UNIQUE(user_id, module)
);

ALTER TABLE module_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own modules"
  ON module_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_module_subscriptions_user ON module_subscriptions(user_id);

-- Configuração dos módulos (preços, descrição) — gerenciada pelo admin
CREATE TABLE IF NOT EXISTS module_config (
  module        TEXT PRIMARY KEY CHECK (module IN ('analise','consulta','conformidade')),
  display_name  TEXT NOT NULL,
  description   TEXT NOT NULL,
  price_cents   INTEGER NOT NULL DEFAULT 0,
  features      TEXT[] NOT NULL DEFAULT '{}',
  active        BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE module_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads module config"
  ON module_config FOR SELECT USING (true);

CREATE POLICY "Admin manages module config"
  ON module_config FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin')
  );

-- Dados iniciais dos módulos
INSERT INTO module_config (module, display_name, description, price_cents, features) VALUES
  ('analise', 'Módulo Análise', 'Geração de ETP, TR, DFD, Cotação, Radar PNCP e Scanner de Editais com IA',
   9900,
   ARRAY['Gerador ETP completo (Art. 18 Lei 14.133/2021)', 'Gerador TR completo (Art. 40)', 'Gerador DFD', 'Cotação inteligente de preços', 'Radar PNCP tempo real', 'Scanner de editais com score 0-100', 'Export PDF e Word (.docx)', 'Citação automática de fontes legais']),
  ('consulta', 'Módulo Consulta', 'Chat jurídico com IA, base de conhecimento RAG e regulamentos municipais',
   7900,
   ARRAY['Chat jurídico 24/7 com Lei 14.133/2021', 'Base de regulamentos do município', 'Notebook com upload de documentos', 'Busca vetorial em regulamentos', 'Respostas com citação de fontes', 'Assistente licitante IA', 'Histórico de consultas']),
  ('conformidade', 'Módulo Conformidade', 'Validação de editais, checklist de conformidade e diagnóstico de modalidade',
   6900,
   ARRAY['Validador de editais com IA', 'Checklist Lei 14.133/2021', 'Diagnóstico de modalidade', 'Verificador de habilitação', 'Relatório de conformidade', 'Citação de artigos violados', 'Conformidade com regulamentos municipais'])
ON CONFLICT (module) DO NOTHING;
