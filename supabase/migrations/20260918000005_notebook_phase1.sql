-- Notebook — Fase 1: RAG ligado, citações reais, persistência do Estúdio e
-- do áudio, e correção de segurança na busca vetorial.

-- ── 1. Busca vetorial: usa o usuário logado em vez de receber o user_id ────
-- A versão anterior era SECURITY DEFINER e recebia p_user_id como parâmetro:
-- qualquer usuário autenticado podia ler chunks de outro usuário via RPC.
DROP FUNCTION IF EXISTS public.match_notebook_chunks(vector, uuid[], uuid, int, float);

CREATE OR REPLACE FUNCTION public.match_notebook_chunks(
  query_embedding vector(1536),
  p_source_ids    UUID[],
  match_count     INT     DEFAULT 8,
  min_similarity  FLOAT   DEFAULT 0.20
)
RETURNS TABLE (
  id          UUID,
  source_id   UUID,
  content     TEXT,
  chunk_index INT,
  char_start  INT,
  char_end    INT,
  similarity  FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    nc.id,
    nc.source_id,
    nc.content,
    nc.chunk_index,
    nc.char_start,
    nc.char_end,
    1 - (nc.embedding <=> query_embedding) AS similarity
  FROM public.notebook_chunks nc
  WHERE nc.source_id = ANY(p_source_ids)
    AND nc.user_id   = auth.uid()
    AND nc.embedding IS NOT NULL
    AND 1 - (nc.embedding <=> query_embedding) > min_similarity
  ORDER BY nc.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 40);
END;
$$;

REVOKE ALL ON FUNCTION public.match_notebook_chunks(vector, uuid[], int, float) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_notebook_chunks(vector, uuid[], int, float) TO authenticated, service_role;

-- ── 2. Status de indexação por fonte ───────────────────────────────────────
ALTER TABLE public.notebook_sources
  ADD COLUMN IF NOT EXISTS embed_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (embed_status IN ('pending', 'processing', 'done', 'error')),
  ADD COLUMN IF NOT EXISTS embed_error  TEXT,
  ADD COLUMN IF NOT EXISTS chunk_count  INTEGER NOT NULL DEFAULT 0;

-- Fontes já indexadas pelo pipeline antigo continuam válidas
UPDATE public.notebook_sources SET embed_status = 'done' WHERE is_embedded = true AND embed_status = 'pending';

-- ── 3. Citações persistidas nas mensagens ──────────────────────────────────
ALTER TABLE public.notebook_messages
  ADD COLUMN IF NOT EXISTS citations JSONB;

-- ── 4. Análises do Estúdio persistidas (uma por tipo por notebook) ─────────
CREATE TABLE IF NOT EXISTS public.notebook_outputs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID        NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  content     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (notebook_id, type)
);

ALTER TABLE public.notebook_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notebook_outputs_own" ON public.notebook_outputs;
CREATE POLICY "notebook_outputs_own" ON public.notebook_outputs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS notebook_outputs_updated_at ON public.notebook_outputs;
CREATE TRIGGER notebook_outputs_updated_at
  BEFORE UPDATE ON public.notebook_outputs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_nb_outputs_nb_id ON public.notebook_outputs(notebook_id);

-- ── 5. Visão Geral em Áudio persistida (MP3 no Storage) ────────────────────
CREATE TABLE IF NOT EXISTS public.notebook_audio_overviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID        NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script      TEXT        NOT NULL DEFAULT '',
  -- [{ speaker: 'A'|'B', text: string, path: string }]
  segments    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (notebook_id)
);

ALTER TABLE public.notebook_audio_overviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notebook_audio_own" ON public.notebook_audio_overviews;
CREATE POLICY "notebook_audio_own" ON public.notebook_audio_overviews
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bucket privado; cada usuário só acessa a própria pasta (<user_id>/...)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('notebook-audio', 'notebook-audio', false, 26214400, ARRAY['audio/mpeg'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "notebook_audio_storage_select" ON storage.objects;
CREATE POLICY "notebook_audio_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'notebook-audio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "notebook_audio_storage_delete" ON storage.objects;
CREATE POLICY "notebook_audio_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'notebook-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
