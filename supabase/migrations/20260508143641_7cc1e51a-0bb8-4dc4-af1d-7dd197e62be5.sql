-- Fix cleanup_pncp_cache function: add SET search_path and switch to SECURITY INVOKER
-- This resolves linter warnings about mutable search path and authenticated users executing SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.cleanup_pncp_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.pncp_cache WHERE created_at < now() - interval '2 hours';
END;
$$;

-- Create minutas table for legal document drafts (impugnacao / esclarecimento)
CREATE TABLE IF NOT EXISTS public.minutas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('impugnacao', 'esclarecimento')),
  titulo TEXT NOT NULL DEFAULT '',
  edital TEXT NOT NULL DEFAULT '',
  orgao TEXT NOT NULL DEFAULT '',
  clausula TEXT NOT NULL DEFAULT '',
  base_legal TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'gerado', 'assinado', 'protocolado')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on minutas
ALTER TABLE public.minutas ENABLE ROW LEVEL SECURITY;

-- RLS policies for minutas
CREATE POLICY "Users can view own minutas"
ON public.minutas
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own minutas"
ON public.minutas
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own minutas"
ON public.minutas
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own minutas"
ON public.minutas
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all minutas"
ON public.minutas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = 'public';

CREATE TRIGGER update_minutas_updated_at
BEFORE UPDATE ON public.minutas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();