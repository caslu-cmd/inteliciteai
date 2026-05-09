-- Documents: ETP and TR saved by agente público
CREATE TABLE IF NOT EXISTS public.documents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL CHECK (tipo IN ('etp', 'tr')),
  titulo     TEXT        NOT NULL DEFAULT '',
  orgao      TEXT        NOT NULL DEFAULT '',
  objeto     TEXT        NOT NULL DEFAULT '',
  conteudo   TEXT        NOT NULL DEFAULT '',
  form_data  JSONB       NOT NULL DEFAULT '{}',
  status     TEXT        NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_own" ON public.documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

-- Chat conversations: persistent history for assistente IA
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Nova conversa',
  messages   JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_conversations_own" ON public.chat_conversations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
