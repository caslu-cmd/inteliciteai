-- Create consultant_verifications table
CREATE TABLE public.consultant_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  cpf TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  birth_date DATE,
  professional_type TEXT NOT NULL DEFAULT 'advogado',
  registration_number TEXT DEFAULT '',
  registration_state TEXT DEFAULT 'SP',
  specialties TEXT[] DEFAULT '{}',
  years_experience INTEGER DEFAULT 0,
  bio TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  doc_identity TEXT DEFAULT '',
  doc_selfie TEXT DEFAULT '',
  doc_professional TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  risk_score INTEGER DEFAULT 0,
  risk_flags TEXT[] DEFAULT '{}',
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.consultant_verifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own verification" 
ON public.consultant_verifications 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own verification" 
ON public.consultant_verifications 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own verification" 
ON public.consultant_verifications 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all verifications" 
ON public.consultant_verifications 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read all verifications" 
ON public.consultant_verifications 
FOR SELECT 
TO public
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create consultant-docs storage bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('consultant-docs', 'consultant-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for consultant-docs
CREATE POLICY "Users can view own consultant docs" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'consultant-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own consultant docs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'consultant-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can manage consultant docs" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'consultant-docs' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read all consultant docs" 
ON storage.objects 
FOR SELECT 
TO public
USING (bucket_id = 'consultant-docs' AND public.has_role(auth.uid(), 'admin'::app_role));