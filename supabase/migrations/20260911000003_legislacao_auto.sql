-- Ingestão automática da legislação (base jurídica): garante idempotência dos
-- chunks para que a rotina de fundo possa reprocessar/upsertar com segurança.
CREATE UNIQUE INDEX IF NOT EXISTS legal_knowledge_chunks_uq
  ON public.legal_knowledge_chunks (knowledge_id, chunk_index);

-- Observação: o preenchimento é feito pela edge function `ingest-legislacao`
-- (modo auto/reset), acionada por pg_cron:
--   * legislacao-drain          '*/5 * * * *'  → processa a próxima fatia
--   * legislacao-refresh-mensal '0 5 1 * *'    → reinicia o cursor (refresh)
-- O segredo do cron fica em public.internal_config (key='cron_secret').
