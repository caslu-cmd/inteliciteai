
-- document_signatures
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clicksign_key TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','signed','cancelled')),
  signer_name   TEXT,
  signer_email  TEXT,
  signer_cpf    TEXT,
  signed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_signatures TO authenticated;
GRANT ALL ON public.document_signatures TO service_role;

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own signatures"
  ON public.document_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own signatures"
  ON public.document_signatures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own signatures"
  ON public.document_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_doc_signatures_document_id ON public.document_signatures(document_id);
CREATE INDEX idx_doc_signatures_user_id ON public.document_signatures(user_id);

-- webhook_configs
CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  events     TEXT[] NOT NULL DEFAULT ARRAY['document.created','document.signed'],
  secret     TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_configs TO authenticated;
GRANT ALL ON public.webhook_configs TO service_role;

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own webhooks"
  ON public.webhook_configs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_webhook_configs_user_id ON public.webhook_configs(user_id);

-- webhook_logs
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id UUID REFERENCES public.webhook_configs(id) ON DELETE CASCADE,
  event             TEXT NOT NULL,
  payload           JSONB,
  response_status   INTEGER,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.webhook_logs TO authenticated;
GRANT ALL ON public.webhook_logs TO service_role;

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own webhook logs"
  ON public.webhook_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_configs wc
      WHERE wc.id = webhook_logs.webhook_config_id
        AND wc.user_id = auth.uid()
    )
  );

CREATE INDEX idx_webhook_logs_config_id ON public.webhook_logs(webhook_config_id);
