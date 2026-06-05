-- Chunks de regulamentos municipais com embeddings
CREATE TABLE IF NOT EXISTS municipality_regulation_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id   UUID NOT NULL REFERENCES municipality_regulations(id) ON DELETE CASCADE,
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  embedding       vector(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_chunks_municipality ON municipality_regulation_chunks(municipality_id);
CREATE INDEX IF NOT EXISTS idx_reg_chunks_regulation  ON municipality_regulation_chunks(regulation_id);

ALTER TABLE municipality_regulation_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Municipality users see regulation chunks"
  ON municipality_regulation_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND municipality_id = municipality_regulation_chunks.municipality_id
    )
  );

CREATE POLICY "Admin manages regulation chunks"
  ON municipality_regulation_chunks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin'));

-- RPC: busca semântica em regulamentos do órgão
CREATE OR REPLACE FUNCTION match_regulation_chunks(
  query_embedding  vector(1536),
  p_municipality_id UUID,
  match_count      INT     DEFAULT 5,
  min_similarity   FLOAT   DEFAULT 0.20
)
RETURNS TABLE(id UUID, regulation_id UUID, content TEXT, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.regulation_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM municipality_regulation_chunks c
  WHERE c.municipality_id = p_municipality_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Chunks de memória do órgão (documentos gerados indexados)
CREATE TABLE IF NOT EXISTS organ_memory_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
  document_tipo   TEXT,
  chunk_index     INTEGER NOT NULL,
  content         TEXT NOT NULL,
  embedding       vector(1536),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_chunks_municipality ON organ_memory_chunks(municipality_id);

ALTER TABLE organ_memory_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Municipality users see memory chunks"
  ON organ_memory_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND municipality_id = organ_memory_chunks.municipality_id
    )
  );

CREATE POLICY "Admin manages memory chunks"
  ON organ_memory_chunks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND platform_role = 'admin'));

-- RPC: busca semântica na memória do órgão
CREATE OR REPLACE FUNCTION match_organ_memory(
  query_embedding   vector(1536),
  p_municipality_id UUID,
  match_count       INT   DEFAULT 4,
  min_similarity    FLOAT DEFAULT 0.25
)
RETURNS TABLE(id UUID, document_id UUID, document_tipo TEXT, content TEXT, similarity FLOAT)
LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.document_id,
    c.document_tipo,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM organ_memory_chunks c
  WHERE c.municipality_id = p_municipality_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;
