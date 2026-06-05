-- Habilita pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Flag de indexação nas fontes
ALTER TABLE public.notebook_sources
  ADD COLUMN IF NOT EXISTS is_embedded BOOLEAN NOT NULL DEFAULT false;

-- Chunks com embeddings para busca semântica
CREATE TABLE IF NOT EXISTS public.notebook_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID        NOT NULL REFERENCES public.notebook_sources(id) ON DELETE CASCADE,
  notebook_id UUID        NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  chunk_index INTEGER     NOT NULL DEFAULT 0,
  char_start  INTEGER     NOT NULL DEFAULT 0,
  char_end    INTEGER     NOT NULL DEFAULT 0,
  embedding   vector(1536),
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notebook_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chunks_own" ON public.notebook_chunks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chunks_source_id   ON public.notebook_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_chunks_notebook_id ON public.notebook_chunks(notebook_id);

-- HNSW: melhor para coleções pequenas/médias (< 1M vetores), busca muito rápida
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON public.notebook_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Função de busca por similaridade semântica
CREATE OR REPLACE FUNCTION match_notebook_chunks(
  query_embedding vector(1536),
  p_source_ids    UUID[],
  p_user_id       UUID,
  match_count     INT     DEFAULT 6,
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
SECURITY DEFINER
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
    AND nc.user_id   = p_user_id
    AND nc.embedding IS NOT NULL
    AND 1 - (nc.embedding <=> query_embedding) > min_similarity
  ORDER BY nc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
