
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'overdue', 'expired', 'blocked', 'cancelled');

-- Enum for payment gateway
CREATE TYPE public.payment_gateway AS ENUM ('mercado_pago', 'gerencianet', 'pagar_me');

-- Enum for plan type
CREATE TYPE public.plan_type AS ENUM ('gratuito', 'profissional', 'gestor_publico', 'empresa', 'institucional');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  organization TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  country TEXT DEFAULT 'Brasil',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan plan_type NOT NULL DEFAULT 'gratuito',
  status subscription_status NOT NULL DEFAULT 'trial',
  gateway payment_gateway,
  gateway_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  price_cents INTEGER NOT NULL DEFAULT 0,
  coupon_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id),
  amount_cents INTEGER NOT NULL,
  gateway payment_gateway NOT NULL,
  gateway_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Coupons table
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Activity logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Plans configuration table
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name plan_type NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES

-- Profiles: users read own, admins read all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

-- User roles: only admins manage
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Subscriptions: own or admin
CREATE POLICY "Users view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own subscription" ON public.subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Payments: own or admin
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage payments" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Coupons: public read, admin manage
CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Notifications: own or admin
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Activity logs: admin only
CREATE POLICY "Admins view logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Plans: public read, admin manage
CREATE POLICY "Anyone can read plans" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  INSERT INTO public.subscriptions (user_id, plan, status, trial_ends_at, price_cents)
  VALUES (NEW.id, 'gratuito', 'trial', now() + interval '7 days', 0);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
