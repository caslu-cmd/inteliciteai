-- Pré-carga noturna da base jurídica (normas citadas pelas íntegras + Constituição),
-- de 1h a 5h (horário de Brasília = 4h a 8h UTC), a cada 15 minutos.
select cron.unschedule('aquecer-normas') where exists (select 1 from cron.job where jobname = 'aquecer-normas');
select cron.schedule('aquecer-normas', '*/15 4-8 * * *', $cron$
  select net.http_post(
    url := 'https://smdafvlyknpswhtandgh.supabase.co/functions/v1/aquecer-normas',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.internal_config where key='cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 240000);
$cron$);
