CREATE TABLE IF NOT EXISTS public.document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('etp','tr','dfd')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_attachments TO authenticated;
GRANT ALL ON public.document_attachments TO service_role;

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own attachments"
  ON public.document_attachments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_document_attachments_user_id ON public.document_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_document_attachments_document_id ON public.document_attachments(document_id);

CREATE TRIGGER update_document_attachments_updated_at
  BEFORE UPDATE ON public.document_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();