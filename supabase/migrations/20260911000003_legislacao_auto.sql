-- Ingestão automática da legislação (base jurídica): garante idempotência dos
-- chunks para que a rotina de fundo possa reprocessar/upsertar com segurança.
CREATE UNIQUE INDEX IF NOT EXISTS legal_knowledge_chunks_uq
  ON public.legal_knowledge_chunks (knowledge_id, chunk_index);

-- Observação: o preenchimento é feito pela edge function `ingest-legislacao`
-- (modo auto/reset), acionada por pg_cron:
--   * legislacao-drain          '*/5 * * * *' → processa a próxima fatia pendente
--   * legislacao-refresh-diario '0 8 * * *'   → reinicia o cursor (verificação
--     diária; só reindexa a lei cujo texto mudou na fonte, poupando OpenAI)
-- O segredo do cron fica em public.internal_config (key='cron_secret').
