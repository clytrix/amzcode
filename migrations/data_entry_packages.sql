-- Data Entry Package System Migration
-- Run this in Supabase SQL Editor

-- Create data_entry_packages table
CREATE TABLE IF NOT EXISTS public.data_entry_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  daily_task_limit INTEGER NOT NULL DEFAULT 20,
  price_inr NUMERIC(10,2) NOT NULL DEFAULT 1500,
  duration_days INTEGER NOT NULL DEFAULT 30,
  reward_per_task NUMERIC(10,2) NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_data_entry_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_data_entry_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.data_entry_packages(id),
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_utr TEXT,
  payment_screenshot_url TEXT,
  admin_approved_by UUID REFERENCES auth.users(id),
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create data_entry_daily_completions table
CREATE TABLE IF NOT EXISTS public.data_entry_daily_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, completion_date)
);

-- Enable RLS
ALTER TABLE public.data_entry_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data_entry_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry_daily_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for data_entry_packages
CREATE POLICY "Anyone can view active packages" 
  ON public.data_entry_packages FOR SELECT 
  USING (is_active = true);

CREATE POLICY "Admin can manage packages" 
  ON public.data_entry_packages FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for user_data_entry_subscriptions
CREATE POLICY "Users can view own subscriptions" 
  ON public.user_data_entry_subscriptions FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own subscriptions" 
  ON public.user_data_entry_subscriptions FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can manage all subscriptions" 
  ON public.user_data_entry_subscriptions FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- RLS Policies for data_entry_daily_completions
CREATE POLICY "Users can view own completions" 
  ON public.data_entry_daily_completions FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "System can manage completions" 
  ON public.data_entry_daily_completions FOR ALL 
  USING (true);

-- Insert default packages
INSERT INTO public.data_entry_packages (name, daily_task_limit, price_inr, duration_days, reward_per_task, display_order, is_active)
VALUES 
  ('Starter', 20, 1500, 30, 100, 1, true),
  ('Basic', 30, 2000, 30, 100, 2, true),
  ('Pro', 40, 2500, 30, 100, 3, true);

-- Grant permissions
GRANT ALL ON public.data_entry_packages TO authenticated, anon, service_role;
GRANT ALL ON public.user_data_entry_subscriptions TO authenticated, service_role;
GRANT ALL ON public.data_entry_daily_completions TO authenticated, service_role;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_data_entry_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_data_entry_subscriptions(payment_status);
CREATE INDEX IF NOT EXISTS idx_daily_completions_user_date ON public.data_entry_daily_completions(user_id, completion_date);
CREATE INDEX IF NOT EXISTS idx_packages_active ON public.data_entry_packages(is_active, display_order);

-- Success message
SELECT 'Data Entry Package System tables created successfully!' as status;
