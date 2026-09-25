-- Catálogo de atos infralegais de compras públicas (INs, portarias, orientações
-- normativas e resoluções) do Portal de Compras do Governo Federal (gov.br/compras),
-- com vigência. Usado pela conferência automática de citações: ato do escopo de compras
-- que não está no catálogo não é mostrado como fato; ato revogado é marcado no texto.
create table if not exists public.atos_compras (
  url            text primary key,
  tipo           text not null,          -- IN | Portaria | ON | Resolução
  orgao          text,                   -- SEGES/ME, SEGES/MGI ...
  numero         integer not null,
  ano            integer,
  titulo         text not null,
  vigente        boolean not null,
  knowledge_id   uuid references public.legal_knowledge(id) on delete set null,
  importado_em   timestamptz,
  visto_em       timestamptz not null default now()
);
create index if not exists atos_compras_tipo_numero on public.atos_compras (tipo, numero, ano);

alter table public.atos_compras enable row level security;
drop policy if exists atos_compras_leitura on public.atos_compras;
create policy atos_compras_leitura on public.atos_compras for select to authenticated using (true);

-- Sincronização: a cada 10 minutos importa alguns atos pendentes; relista o catálogo
-- (vigentes e revogados) uma vez por dia.
select cron.unschedule('atos-compras-sync') where exists (select 1 from cron.job where jobname = 'atos-compras-sync');
select cron.schedule('atos-compras-sync', '5-59/10 * * * *', $cron$
  select net.http_post(
    url := 'https://smdafvlyknpswhtandgh.supabase.co/functions/v1/sync-atos-compras',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_config where key='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 240000);
$cron$);
