-- Monitor do PNCP: a cada 5 min o banco pinga a busca e a consulta oficial do
-- portal e guarda o resultado; o pncp-proxy também registra o resultado real
-- de cada chamada. O front lê os últimos minutos e mostra "operante /
-- instável / fora do ar" em todas as telas.

create table if not exists public.pncp_health (
  id          bigint generated always as identity primary key,
  checked_at  timestamptz not null default now(),
  endpoint    text not null check (endpoint in ('busca', 'consulta')),
  ok          boolean not null,
  status_code int,
  latency_ms  int,
  detail      text,
  origem      text not null default 'monitor'   -- 'monitor' (cron) | 'proxy' (tráfego real)
);
create index if not exists idx_pncp_health_checked on public.pncp_health (checked_at desc);

alter table public.pncp_health enable row level security;
drop policy if exists "pncp_health_read" on public.pncp_health;
create policy "pncp_health_read" on public.pncp_health
  for select to authenticated using (true);
-- escrita: só service_role / função definer (sem política para authenticated)

-- Requisições disparadas pelo pg_net aguardando resposta.
create table if not exists public.pncp_health_pending (
  request_id bigint primary key,
  endpoint   text not null,
  fired_at   timestamptz not null default now()
);
alter table public.pncp_health_pending enable row level security;

create or replace function public.pncp_health_check()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  r record;
begin
  -- 1) Fecha as pendentes da rodada anterior.
  for p in select * from public.pncp_health_pending loop
    select * into r from net._http_response where id = p.request_id;
    if found then
      insert into public.pncp_health (checked_at, endpoint, ok, status_code, latency_ms, detail, origem)
      values (
        coalesce(r.created, now()), p.endpoint,
        (coalesce(r.status_code, 0) between 200 and 399) and not coalesce(r.timed_out, false),
        r.status_code,
        greatest(0, (extract(epoch from (coalesce(r.created, now()) - p.fired_at)) * 1000)::int),
        left(coalesce(r.error_msg, ''), 200),
        'monitor'
      );
      delete from public.pncp_health_pending where request_id = p.request_id;
    elsif p.fired_at < now() - interval '4 minutes' then
      insert into public.pncp_health (checked_at, endpoint, ok, status_code, latency_ms, detail, origem)
      values (now(), p.endpoint, false, null, null, 'sem resposta', 'monitor');
      delete from public.pncp_health_pending where request_id = p.request_id;
    end if;
  end loop;

  -- 2) Dispara a nova rodada (busca e consulta oficial, 1 item cada).
  insert into public.pncp_health_pending (request_id, endpoint) values (
    net.http_get(
      'https://pncp.gov.br/api/search/?q=&tipos_documento=edital&ordenacao=-data&pagina=1&tam_pagina=1&status=recebendo_proposta',
      headers => '{"Accept":"application/json","User-Agent":"Intelicite/1.0"}'::jsonb,
      timeout_milliseconds => 10000
    ), 'busca');
  insert into public.pncp_health_pending (request_id, endpoint) values (
    net.http_get(
      'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal='
        || to_char(now() + interval '365 days', 'YYYYMMDD')
        || '&codigoModalidadeContratacao=6&pagina=1&tamanhoPagina=1',
      headers => '{"Accept":"application/json","User-Agent":"Intelicite/1.0"}'::jsonb,
      timeout_milliseconds => 10000
    ), 'consulta');

  -- 3) Retenção: 7 dias.
  delete from public.pncp_health where checked_at < now() - interval '7 days';
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pncp-health-check') then
    perform cron.unschedule('pncp-health-check');
  end if;
end $$;
select cron.schedule('pncp-health-check', '*/5 * * * *', 'select public.pncp_health_check()');

-- Primeira rodada agora.
select public.pncp_health_check();
