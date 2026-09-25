-- Espelho dos acórdãos do TCU (API de dados abertos do TCU), usado pela conferência
-- automática de citações: um "Acórdão N/AAAA" citado pela IA só é mostrado se existir.
-- A API expõe cerca de 57 mil acórdãos, de agosto de 2023 em diante.
create table if not exists public.tcu_acordaos (
  key          text primary key,
  tipo         text,
  numero       integer not null,
  ano          integer not null,
  colegiado    text,
  relator      text,
  data_sessao  date,
  situacao     text,
  sumario      text,
  url          text,
  atualizado_em timestamptz not null default now()
);
create index if not exists tcu_acordaos_numero_ano on public.tcu_acordaos (numero, ano);

alter table public.tcu_acordaos enable row level security;
-- leitura para usuários logados; escrita só pela service role (função de sincronização)
drop policy if exists tcu_acordaos_leitura on public.tcu_acordaos;
create policy tcu_acordaos_leitura on public.tcu_acordaos for select to authenticated using (true);

-- Sincronização a cada 10 minutos (novos acórdãos + preenchimento do histórico até o fim).
select cron.unschedule('tcu-acordaos-sync') where exists (select 1 from cron.job where jobname = 'tcu-acordaos-sync');
select cron.schedule('tcu-acordaos-sync', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://smdafvlyknpswhtandgh.supabase.co/functions/v1/sync-tcu-acordaos',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_config where key='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 240000);
$cron$);
