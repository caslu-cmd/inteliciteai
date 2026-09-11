-- Perfil da empresa licitante, usado pelo "Match IA" do Radar de Oportunidades
-- (descrição livre do que a empresa fornece / palavras-chave / segmentos).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empresa_perfil TEXT;
