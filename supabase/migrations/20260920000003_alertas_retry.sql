-- Alertas diários: retentativa às 11h (BRT) caso a rodada das 8h não tenha
-- concluído (PNCP fora do ar, tempo esgotado). A função só age se
-- internal_config.alertas_ultimo_ok ainda não for a data de hoje.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'alertas-editais-retry') then
    perform cron.unschedule('alertas-editais-retry');
  end if;
end $$;

select cron.schedule(
  'alertas-editais-retry',
  '0 14 * * *',
  $$
    select net.http_post(
      url := 'https://smdafvlyknpswhtandgh.supabase.co/functions/v1/alertas-editais',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select value from public.internal_config where key = 'cron_secret')
      ),
      body := '{"retry": true}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);

-- A rodada principal passa a ter tempo para o Match IA (era 60 s).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'alertas-editais-diario') then
    perform cron.unschedule('alertas-editais-diario');
  end if;
end $$;

select cron.schedule(
  'alertas-editais-diario',
  '0 11 * * *',
  $$
    select net.http_post(
      url := 'https://smdafvlyknpswhtandgh.supabase.co/functions/v1/alertas-editais',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select value from public.internal_config where key = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);
