
-- 1. Update default KYC fee from 799 (legacy INR) to 79 (USD)
ALTER TABLE public.kyc_submissions ALTER COLUMN fee_amount SET DEFAULT 79;

-- 2. Attendance system
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  work_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_out_at TIMESTAMPTZ,
  hours_worked NUMERIC GENERATED ALWAYS AS (
    CASE WHEN check_out_at IS NULL THEN NULL
         ELSE ROUND(EXTRACT(EPOCH FROM (check_out_at - check_in_at))::numeric / 3600, 2)
    END
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users insert own attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own attendance open" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id AND check_out_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins manage attendance" ON public.attendance
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, work_date DESC);

-- 3. Add Development Modules category
INSERT INTO public.job_categories (slug, name, description, icon)
VALUES ('development', 'Development Modules', 'Web, app and backend development engagements', 'code')
ON CONFLICT (slug) DO NOTHING;
