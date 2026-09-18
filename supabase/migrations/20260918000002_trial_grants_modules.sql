-- Trial vigente ou plano ativo concede os 3 módulos em module_subscriptions.
-- Mantém o banco como fonte da verdade: o front (useModuleAccess) e o
-- admin (AdminUsersTab) passam a ver os módulos liberados para trial/pago.
-- As linhas concedidas têm price_cents = 0 e expiram via next_billing_at
-- (= trial_ends_at / current_period_end); módulos comprados (price > 0)
-- nunca são sobrescritos.

create or replace function public.sync_modules_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fim timestamptz;
begin
  if new.status = 'trial' then
    fim := new.trial_ends_at;
  elsif new.status = 'active' then
    fim := new.current_period_end;
  else
    return new;
  end if;

  insert into public.module_subscriptions
    (user_id, module, active, price_cents, unlocked_at, next_billing_at, cancelled_at)
  select new.user_id, m, true, 0, now(), fim, null
  from unnest(array['analise', 'consulta', 'conformidade']) as m
  on conflict (user_id, module) do update
    set active = true,
        next_billing_at = excluded.next_billing_at,
        cancelled_at = null
    where public.module_subscriptions.price_cents = 0;

  return new;
end;
$$;

drop trigger if exists trg_sync_modules_from_subscription on public.subscriptions;
create trigger trg_sync_modules_from_subscription
after insert or update of status, trial_ends_at, current_period_end
on public.subscriptions
for each row execute function public.sync_modules_from_subscription();

-- Backfill: quem já está em trial vigente ou plano ativo recebe os módulos agora.
insert into public.module_subscriptions
  (user_id, module, active, price_cents, unlocked_at, next_billing_at, cancelled_at)
select s.user_id, m, true, 0, now(),
       case when s.status = 'trial' then s.trial_ends_at else s.current_period_end end,
       null
from public.subscriptions s
cross join unnest(array['analise', 'consulta', 'conformidade']) as m
where (s.status = 'trial'  and s.trial_ends_at > now())
   or (s.status = 'active' and (s.current_period_end is null or s.current_period_end > now()))
on conflict (user_id, module) do update
  set active = true,
      next_billing_at = excluded.next_billing_at,
      cancelled_at = null
  where public.module_subscriptions.price_cents = 0;
