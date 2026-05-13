DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'inteliciteoficial@gmail.com';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'inteliciteoficial@gmail.com',
      crypt('010233@Vcm', gen_salt('bf')),
      now(),
      '{"full_name": "Intelicite Oficial", "role": "gestor"}'::jsonb,
      '{"provider": "email", "providers": ["email"]}'::jsonb
    );

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider
    ) VALUES (
      'inteliciteoficial@gmail.com',
      v_user_id,
      json_build_object('sub', v_user_id::text, 'email', 'inteliciteoficial@gmail.com')::jsonb,
      'email'
    );
  END IF;

  INSERT INTO public.subscriptions (
    user_id,
    status,
    plan,
    price_cents,
    trial_ends_at
  )
  VALUES (
    v_user_id,
    'active',
    'gratuito',
    0,
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    plan = 'gratuito',
    price_cents = 0,
    trial_ends_at = NULL,
    updated_at = now();

  INSERT INTO public.consultant_verifications (
    user_id,
    full_name,
    cpf,
    phone,
    professional_type,
    specialties,
    years_experience,
    bio,
    status,
    risk_score,
    risk_flags
  )
  VALUES (
    v_user_id,
    'Intelicite Oficial',
    '00000000000',
    '(00) 00000-0000',
    'outro',
    ARRAY['Lei 14.133/2021','Pregão Eletrônico','Contratos Administrativos'],
    5,
    'Equipe oficial da plataforma Intelicite AI.',
    'approved',
    0,
    ARRAY[]::text[]
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'approved',
    updated_at = now();
END $$;