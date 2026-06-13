-- Essential Schema for AMZ Solution
-- Run this in Supabase SQL Editor first, then run the data migration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

DROP TYPE IF EXISTS public.application_status CASCADE;
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');

DROP TYPE IF EXISTS public.kyc_status CASCADE;
CREATE TYPE public.kyc_status AS ENUM ('not_started', 'fee_pending', 'fee_paid', 'payment_submitted', 'documents_submitted', 'approved', 'rejected');

DROP TYPE IF EXISTS public.disbursement_status CASCADE;
CREATE TYPE public.disbursement_status AS ENUM ('pending', 'held', 'paid', 'cancelled');

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- User roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role DEFAULT 'employee' NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance_inr numeric DEFAULT 0 NOT NULL,
    total_earned_inr numeric DEFAULT 0 NOT NULL,
    total_withdrawn_inr numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_inr numeric NOT NULL,
    type text NOT NULL,
    description text,
    reference_id uuid,
    reference_type text,
    created_at timestamp with time zone DEFAULT now()
);

-- KYC submissions
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status public.kyc_status DEFAULT 'not_started' NOT NULL,
    payment_utr text,
    payment_screenshot_url text,
    id_document_url text,
    address_document_url text,
    admin_approved_by uuid REFERENCES auth.users(id),
    admin_approved_at timestamp with time zone,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    requirements text,
    location text,
    employment_type text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Job applications
CREATE TABLE IF NOT EXISTS public.job_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status public.application_status DEFAULT 'pending' NOT NULL,
    cover_letter text,
    resume_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    status text DEFAULT 'active',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id uuid REFERENCES public.jobs(id),
    project_id uuid REFERENCES public.projects(id),
    title text NOT NULL,
    description text,
    status text DEFAULT 'todo',
    priority text DEFAULT 'medium',
    due_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject text NOT NULL,
    description text,
    status text DEFAULT 'open',
    priority text DEFAULT 'medium',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Ticket messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    work_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    check_in_at timestamp with time zone DEFAULT now() NOT NULL,
    check_out_at timestamp with time zone,
    hours_worked numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

-- Earnings
CREATE TABLE IF NOT EXISTS public.earnings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id uuid REFERENCES public.tasks(id),
    amount_inr numeric NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);

-- Salary disbursements
CREATE TABLE IF NOT EXISTS public.salary_disbursements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    base_salary_inr numeric NOT NULL,
    total_earnings_inr numeric DEFAULT 0,
    status public.disbursement_status DEFAULT 'pending',
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Withdrawals
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_inr numeric NOT NULL,
    status text DEFAULT 'pending',
    bank_account_id uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Platform settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key text PRIMARY KEY,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- Email templates
CREATE TABLE IF NOT EXISTS public.email_templates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    template_key text NOT NULL UNIQUE,
    name text NOT NULL,
    subject text NOT NULL,
    html_body text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Login IPs
CREATE TABLE IF NOT EXISTS public.login_ips (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Employment packages
CREATE TABLE IF NOT EXISTS public.employment_packages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id uuid REFERENCES public.jobs(id),
    started_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Data Entry tables
CREATE TABLE IF NOT EXISTS public.data_entry_invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    vendor_name text NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date,
    amount numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    gst_number text,
    image_url text,
    notes text,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_entry_daily_pool (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    pool_date date DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'::text))::date NOT NULL,
    invoice_id uuid NOT NULL REFERENCES public.data_entry_invoices(id),
    reward_amount numeric DEFAULT 150 NOT NULL,
    position integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_entry_submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pool_id uuid NOT NULL REFERENCES public.data_entry_daily_pool(id),
    vendor_name text NOT NULL,
    invoice_number text NOT NULL,
    invoice_date date,
    amount numeric,
    tax_amount numeric,
    gst_number text,
    extracted_data jsonb,
    status text DEFAULT 'pending',
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Data Entry Package System
CREATE TABLE IF NOT EXISTS public.data_entry_packages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    daily_task_limit integer NOT NULL DEFAULT 20,
    price_inr numeric(10,2) NOT NULL DEFAULT 1500,
    duration_days integer NOT NULL DEFAULT 30,
    reward_per_task numeric(10,2) NOT NULL DEFAULT 100,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_data_entry_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    package_id uuid NOT NULL REFERENCES public.data_entry_packages(id),
    purchased_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    payment_status text NOT NULL DEFAULT 'pending',
    payment_utr text,
    payment_screenshot_url text,
    admin_approved_by uuid REFERENCES auth.users(id),
    admin_approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_entry_daily_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completion_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
    tasks_completed integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, completion_date)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry_daily_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data_entry_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry_daily_completions ENABLE ROW LEVEL SECURITY;

-- Insert default data entry packages
INSERT INTO public.data_entry_packages (name, daily_task_limit, price_inr, duration_days, reward_per_task, display_order, is_active)
VALUES 
  ('Starter', 20, 1500, 30, 100, 1, true),
  ('Basic', 30, 2000, 30, 100, 2, true),
  ('Pro', 40, 2500, 30, 100, 3, true)
ON CONFLICT DO NOTHING;

-- Success message
SELECT 'Essential schema created successfully!' as status;
