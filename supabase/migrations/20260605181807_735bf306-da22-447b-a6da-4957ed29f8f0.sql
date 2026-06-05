
CREATE TABLE IF NOT EXISTS public.legal_knowledge (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('lei','acordao_tcu','sumula_tcu','orientacao_agu','instrucao_normativa','doutrina','outro')),
  reference   TEXT,
  year        INTEGER,
  content     TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.legal_knowledge TO authenticated;
GRANT ALL ON public.legal_knowledge TO service_role;
ALTER TABLE public.legal_knowledge ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.legal_knowledge_chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES public.legal_knowledge(id) ON DELETE CASCADE,
  chunk_index  INTEGER NOT NULL,
  content      TEXT NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT ON public.legal_knowledge_chunks TO authenticated;
GRANT ALL ON public.legal_knowledge_chunks TO service_role;
ALTER TABLE public.legal_knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_legal_chunks_knowledge ON public.legal_knowledge_chunks(knowledge_id);

CREATE POLICY "Auth users read legal knowledge"
  ON public.legal_knowledge FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Auth users read legal chunks"
  ON public.legal_knowledge_chunks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manages legal knowledge"
  ON public.legal_knowledge FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin manages legal chunks"
  ON public.legal_knowledge_chunks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.match_legal_knowledge(
  query_embedding vector(1536),
  match_count     INT   DEFAULT 6,
  min_similarity  FLOAT DEFAULT 0.22
)
RETURNS TABLE(id UUID, knowledge_id UUID, content TEXT, similarity FLOAT)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.knowledge_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.legal_knowledge_chunks c
  JOIN public.legal_knowledge k ON k.id = c.knowledge_id
  WHERE k.active = true
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
