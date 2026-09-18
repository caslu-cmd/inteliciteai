-- Precificação estratégica: simulações de proposta econômica do licitante.

CREATE TABLE IF NOT EXISTS public.precificacao_simulacoes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo           TEXT        NOT NULL,
  orgao            TEXT        NOT NULL DEFAULT '',
  valor_estimado   NUMERIC     NOT NULL DEFAULT 0,
  custo            NUMERIC     NOT NULL DEFAULT 0,
  margem_desejada  NUMERIC     NOT NULL DEFAULT 0,
  num_concorrentes INTEGER     NOT NULL DEFAULT 0,
  preco_sugerido   NUMERIC     NOT NULL DEFAULT 0,
  margem           NUMERIC     NOT NULL DEFAULT 0,
  prob_vitoria     INTEGER     NOT NULL DEFAULT 0,
  recomendacao     TEXT        NOT NULL DEFAULT 'moderado'
                     CHECK (recomendacao IN ('agressivo', 'moderado', 'conservador')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.precificacao_simulacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "precificacao_own" ON public.precificacao_simulacoes;
CREATE POLICY "precificacao_own" ON public.precificacao_simulacoes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS precificacao_user_idx ON public.precificacao_simulacoes(user_id);
