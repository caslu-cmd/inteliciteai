-- Dados estruturados da empresa (Receita Federal, via cnpj-proxy) e o
-- complemento em texto livre. empresa_perfil continua sendo o texto
-- consolidado que o Match IA e os alertas usam.
alter table public.profiles
  add column if not exists empresa_cnpj text,
  add column if not exists empresa_dados jsonb,
  add column if not exists empresa_complemento text;
