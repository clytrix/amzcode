-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.task_status AS ENUM ('assigned', 'in_progress', 'submitted', 'approved', 'rejected');
CREATE TYPE public.kyc_status AS ENUM ('not_started', 'fee_pending', 'fee_paid', 'documents_submitted', 'approved', 'rejected');
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'paid', 'rejected');
CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE public.ticket_category AS ENUM ('kyc', 'payment', 'task', 'general');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES (separate table) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ JOB CATEGORIES ============
CREATE TABLE public.job_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.job_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  responsibilities TEXT,
  location TEXT NOT NULL DEFAULT 'Remote / Work From Home',
  employment_type TEXT NOT NULL DEFAULT 'Full-time',
  salary_min NUMERIC(12,2),
  salary_max NUMERIC(12,2),
  salary_currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- ============ JOB APPLICATIONS ============
CREATE TABLE public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_letter TEXT,
  experience TEXT,
  status application_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status task_status NOT NULL DEFAULT 'assigned',
  submission_notes TEXT,
  submission_url TEXT,
  deadline TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ============ EARNINGS ============
CREATE TABLE public.earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'task', -- task, bonus, salary
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

-- ============ KYC ============
CREATE TABLE public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status kyc_status NOT NULL DEFAULT 'not_started',
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 79,
  fee_paid_at TIMESTAMPTZ,
  fee_payment_reference TEXT,
  full_name TEXT,
  date_of_birth DATE,
  document_type TEXT,
  document_number TEXT,
  document_front_url TEXT,
  document_back_url TEXT,
  selfie_url TEXT,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  bank_name TEXT,
  bank_ifsc_swift TEXT,
  upi_id TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- ============ WITHDRAWALS ============
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  payout_method TEXT,
  payout_details TEXT,
  admin_notes TEXT,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- ============ TICKETS ============
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category ticket_category NOT NULL DEFAULT 'general',
  status ticket_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- ============ SALARY SLIPS ============
CREATE TABLE public.salary_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_month, period_year)
);
ALTER TABLE public.salary_slips ENABLE ROW LEVEL SECURITY;

-- ============ LOGIN IPs (trusted devices) ============
CREATE TABLE public.login_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ip_address)
);
ALTER TABLE public.login_ips ENABLE ROW LEVEL SECURITY;

-- ============ OTP CODES ============
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL, -- signup, new_ip
  ip_address TEXT,
  user_agent TEXT,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_otp_email_purpose ON public.otp_codes(email, purpose);

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_applications_updated BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_withdrawals_updated BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ SIGNUP TRIGGER (profile + role) ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  INSERT INTO public.kyc_submissions (user_id, status) VALUES (NEW.id, 'not_started');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- job_categories - public read, admin write
CREATE POLICY "anyone view categories" ON public.job_categories FOR SELECT USING (true);
CREATE POLICY "admins manage categories" ON public.job_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- jobs - public read active, admin all
CREATE POLICY "anyone view active jobs" ON public.jobs FOR SELECT USING (is_active = true);
CREATE POLICY "admins view all jobs" ON public.jobs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage jobs" ON public.jobs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- applications
CREATE POLICY "users view own apps" ON public.job_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users create own apps" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view all apps" ON public.job_applications FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage apps" ON public.job_applications FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- tasks
CREATE POLICY "users view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage tasks" ON public.tasks FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- earnings
CREATE POLICY "users view own earnings" ON public.earnings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage earnings" ON public.earnings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- kyc
CREATE POLICY "users view own kyc" ON public.kyc_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own kyc" ON public.kyc_submissions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage kyc" ON public.kyc_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- withdrawals
CREATE POLICY "users view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users create own withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage withdrawals" ON public.withdrawals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- tickets
CREATE POLICY "users view own tickets" ON public.tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users create own tickets" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own tickets" ON public.tickets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage tickets" ON public.tickets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ticket_messages
CREATE POLICY "users view own ticket msgs" ON public.ticket_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
);
CREATE POLICY "users create own ticket msgs" ON public.ticket_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tickets WHERE id = ticket_id AND user_id = auth.uid())
);
CREATE POLICY "admins view all ticket msgs" ON public.ticket_messages FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create ticket msgs" ON public.ticket_messages FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') AND sender_id = auth.uid());

-- salary slips
CREATE POLICY "users view own slips" ON public.salary_slips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins manage slips" ON public.salary_slips FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- login_ips
CREATE POLICY "users view own ips" ON public.login_ips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all ips" ON public.login_ips FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- otp_codes - server only (no client access)
-- (no policies => denied for everyone via RLS; only service role can access)

-- ============ SEED CATEGORIES ============
INSERT INTO public.job_categories (name, slug, description, icon) VALUES
  ('Customer Service Associate', 'customer-service', 'Handle customer calls and chats — most common WFH role', 'Headphones'),
  ('Data Entry / Catalog Associate', 'data-entry', 'Update product data, images, prices and descriptions', 'Database'),
  ('Virtual Assistant / Seller Support', 'virtual-assistant', 'Help Amazon sellers manage orders and accounts', 'Package'),
  ('Technical Support', 'technical-support', 'Solve app and website issues, guide customers', 'Wrench'),
  ('Content Writing / Review Work', 'content-writing', 'Write product descriptions and SEO content', 'PenTool'),
  ('HR / Recruitment Support', 'hr-recruitment', 'Handle hiring, candidate communication, document verification', 'Users'),
  ('Backend Operations', 'backend-ops', 'Data processing and back-office support', 'Server')
ON CONFLICT (slug) DO NOTHING;
