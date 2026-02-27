
-- Table to store gateway configurations securely (admin-only access)
CREATE TABLE public.gateway_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id text UNIQUE NOT NULL,
  config_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gateway_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can access gateway configs
CREATE POLICY "Admins manage gateway configs"
  ON public.gateway_configs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
