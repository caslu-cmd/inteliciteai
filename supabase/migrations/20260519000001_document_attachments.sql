-- Relatórios históricos (PDFs anuais enviados pelo usuário)
CREATE TABLE IF NOT EXISTS public.historical_reports (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano            INTEGER     NOT NULL,
  file_name      TEXT        NOT NULL,
  file_path      TEXT        NOT NULL DEFAULT '',
  file_size      INTEGER     NOT NULL DEFAULT 0,
  orgao          TEXT        NOT NULL DEFAULT '',
  texto_extraido TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.historical_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historical_reports_own" ON public.historical_reports
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Previsões anuais geradas pela IA a partir dos relatórios históricos
CREATE TABLE IF NOT EXISTS public.annual_forecasts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano_previsao       INTEGER     NOT NULL,
  orgao              TEXT        NOT NULL DEFAULT '',
  tipo_documento     TEXT        NOT NULL DEFAULT 'etp' CHECK (tipo_documento IN ('etp', 'tr', 'dfd')),
  narrativa          TEXT        NOT NULL DEFAULT '',
  dados_estruturados JSONB       NOT NULL DEFAULT '{}',
  report_ids         UUID[]      NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.annual_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "annual_forecasts_own" ON public.annual_forecasts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER annual_forecasts_updated_at
  BEFORE UPDATE ON public.annual_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- Arquivos anexados a documentos ETP / TR / DFD salvos
CREATE TABLE IF NOT EXISTS public.document_attachments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo           TEXT        NOT NULL CHECK (tipo IN ('relatorio_historico', 'previsao', 'outro')),
  file_name      TEXT        NOT NULL,
  file_path      TEXT        NOT NULL DEFAULT '',
  file_size      INTEGER     NOT NULL DEFAULT 0,
  ano_referencia INTEGER,
  forecast_id    UUID        REFERENCES public.annual_forecasts(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_attachments_own" ON public.document_attachments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Permite DFD no tipo de documentos (além de etp e tr já existentes)
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_tipo_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_tipo_check CHECK (tipo IN ('etp', 'tr', 'dfd'));

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_historical_reports_user_ano  ON public.historical_reports(user_id, ano DESC);
CREATE INDEX IF NOT EXISTS idx_annual_forecasts_user        ON public.annual_forecasts(user_id, ano_previsao DESC);
CREATE INDEX IF NOT EXISTS idx_document_attachments_doc     ON public.document_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_user    ON public.document_attachments(user_id);
