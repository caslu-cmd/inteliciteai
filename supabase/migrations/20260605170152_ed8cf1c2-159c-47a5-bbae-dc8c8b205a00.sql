-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- regulation_chunks: chunks vetorizados de municipality_regulations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.regulation_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id UUID NOT NULL,
  municipality_id UUID NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.regulation_chunks TO authenticated;
GRANT ALL ON public.regulation_chunks TO service_role;

ALTER TABLE public.regulation_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Municipality users read regulation chunks"
  ON public.regulation_chunks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.municipality_id = regulation_chunks.municipality_id
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin manages regulation chunks"
  ON public.regulation_chunks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS regulation_chunks_regulation_idx
  ON public.regulation_chunks(regulation_id);
CREATE INDEX IF NOT EXISTS regulation_chunks_municipality_idx
  ON public.regulation_chunks(municipality_id);
CREATE INDEX IF NOT EXISTS regulation_chunks_embedding_idx
  ON public.regulation_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- document_memory_chunks: memória semântica de documentos do usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_memory_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_id UUID,
  source_type TEXT NOT NULL DEFAULT 'document',
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_memory_chunks TO authenticated;
GRANT ALL ON public.document_memory_chunks TO service_role;

ALTER TABLE public.document_memory_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own memory chunks"
  ON public.document_memory_chunks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS document_memory_user_idx
  ON public.document_memory_chunks(user_id);
CREATE INDEX IF NOT EXISTS document_memory_document_idx
  ON public.document_memory_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_memory_embedding_idx
  ON public.document_memory_chunks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- RPC: match_regulations
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_regulations(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter_municipality UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  regulation_id UUID,
  municipality_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    rc.id,
    rc.regulation_id,
    rc.municipality_id,
    rc.content,
    rc.metadata,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM public.regulation_chunks rc
  WHERE rc.embedding IS NOT NULL
    AND (filter_municipality IS NULL OR rc.municipality_id = filter_municipality)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- RPC: match_document_memory
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_document_memory(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter_user UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    dm.id,
    dm.document_id,
    dm.content,
    dm.metadata,
    1 - (dm.embedding <=> query_embedding) AS similarity
  FROM public.document_memory_chunks dm
  WHERE dm.embedding IS NOT NULL
    AND (filter_user IS NULL OR dm.user_id = filter_user)
  ORDER BY dm.embedding <=> query_embedding
  LIMIT match_count;
$$;