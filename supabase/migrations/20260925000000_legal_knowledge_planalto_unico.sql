-- Normas importadas do Planalto pela conferência automática de citações: uma linha por
-- norma. Duas consultas simultâneas chegaram a gravar a mesma lei duas vezes.
create unique index if not exists legal_knowledge_reference_planalto
  on public.legal_knowledge (reference)
  where title like '%íntegra do Planalto%';
