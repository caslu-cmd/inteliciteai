-- Consultant verification system with anti-fraud fields

CREATE TABLE IF NOT EXISTS public.consultant_verifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Personal
  full_name            TEXT NOT NULL,
  cpf                  TEXT NOT NULL,
  phone                TEXT NOT NULL,
  birth_date           DATE,

  -- Professional
  professional_type    TEXT NOT NULL DEFAULT 'outro'
    CHECK (professional_type IN ('advogado','contador','administrador','engenheiro','economista','outro')),
  registration_number  TEXT,
  registration_state   TEXT,
  specialties          TEXT[] DEFAULT '{}',
  years_experience     INTEGER DEFAULT 0,
  bio                  TEXT,
  linkedin_url         TEXT,

  -- Documents (Storage paths)
  doc_identity         TEXT,
  doc_selfie           TEXT,
  doc_professional     TEXT,

  -- Status
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','approved','rejected','flagged')),
  rejection_reason     TEXT,
  reviewed_by          UUID REFERENCES auth.users(id),
  reviewed_at          TIMESTAMPTZ,

  -- Anti-fraud
  risk_score           INTEGER DEFAULT 0,
  risk_flags           JSONB DEFAULT '[]'::jsonb,

  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.consultant_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own verification"
  ON public.consultant_verifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own verification"
  ON public.consultant_verifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own pending verification"
  ON public.consultant_verifications FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('pending','rejected'));

CREATE POLICY "Admins read all verifications"
  ON public.consultant_verifications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all verifications"
  ON public.consultant_verifications FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('consultant-docs', 'consultant-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'consultant-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'consultant-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins read all consultant docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'consultant-docs' AND
    public.has_role(auth.uid(), 'admin')
  );
