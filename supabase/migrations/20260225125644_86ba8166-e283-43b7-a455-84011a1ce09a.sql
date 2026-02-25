
-- Set admin's subscription to lifetime active with profissional plan
UPDATE public.subscriptions 
SET plan = 'profissional', 
    status = 'active', 
    price_cents = 0, 
    trial_ends_at = NULL,
    current_period_start = now(),
    current_period_end = '2099-12-31'::timestamptz
WHERE user_id = '2ad179b6-7b26-4240-95f1-c2fb414c73e5';

-- Remove old plans from DB and ensure only 2 exist
DELETE FROM public.plans WHERE name NOT IN ('gratuito', 'profissional');

-- Upsert the two plans
INSERT INTO public.plans (name, display_name, price_cents, features, active) 
VALUES 
  ('gratuito', 'Gratuito', 0, '["Acesso completo por 7 dias","Assistente Jurídico IA","Gerador de ETP e TR","Validador de Editais","Diagnóstico de Licitação"]', true),
  ('profissional', 'Profissional', 29700, '["Assistente Jurídico IA ilimitado","Gerador de ETP e TR","Validador de Editais","Diagnóstico de Licitação","Checklist de Qualificação","Exportação PDF e Word","Cotação Inteligente","Relatórios avançados","Suporte prioritário"]', true)
ON CONFLICT (name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  price_cents = EXCLUDED.price_cents,
  features = EXCLUDED.features,
  active = EXCLUDED.active;
