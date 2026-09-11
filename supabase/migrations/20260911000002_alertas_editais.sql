-- Alertas diários de novos editais compatíveis (diferencial vs. Settle)

-- Preferências de alerta por licitante
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS alerta_ativo    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerta_keywords TEXT,
  ADD COLUMN IF NOT EXISTS alerta_uf       TEXT;

-- Deduplicação: registra quais editais já foram notificados a cada usuário
CREATE TABLE IF NOT EXISTS public.alertas_enviados (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edital_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, edital_id)
);
ALTER TABLE public.alertas_enviados ENABLE ROW LEVEL SECURITY;
-- Sem policies: acessível apenas via service role (edge function).

-- Config interna (ex.: segredo usado pelo cron para chamar a edge function)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service role lê/escreve.
