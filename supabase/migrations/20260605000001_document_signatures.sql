-- Assinatura eletrônica via ClickSign
CREATE TABLE IF NOT EXISTS document_signatures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID REFERENCES documents(id) ON DELETE CASCADE,
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

ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own signatures"
  ON document_signatures FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own signatures"
  ON document_signatures FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own signatures"
  ON document_signatures FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_doc_signatures_document_id ON document_signatures(document_id);
CREATE INDEX idx_doc_signatures_user_id     ON document_signatures(user_id);
