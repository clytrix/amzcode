
-- ============================================================
-- 1. EMPLOYMENT PACKAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employment_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id UUID,
  application_id UUID,
  monthly_salary NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  perks JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employment_packages_user ON public.employment_packages(user_id, is_active);

ALTER TABLE public.employment_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage packages" ON public.employment_packages
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users view own packages" ON public.employment_packages
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_employment_packages_updated_at
  BEFORE UPDATE ON public.employment_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 2. SALARY DISBURSEMENTS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.disbursement_status AS ENUM ('pending', 'held', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.salary_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  package_id UUID,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  basic_amount NUMERIC NOT NULL DEFAULT 0,
  overtime_amount NUMERIC NOT NULL DEFAULT 0,
  bonus NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  status public.disbursement_status NOT NULL DEFAULT 'pending',
  hold_reason TEXT,
  paid_at TIMESTAMPTZ,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_year, period_month)
);
CREATE INDEX IF NOT EXISTS idx_salary_disbursements_user ON public.salary_disbursements(user_id, period_year, period_month);

ALTER TABLE public.salary_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage disbursements" ON public.salary_disbursements
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users view own disbursements" ON public.salary_disbursements
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_salary_disbursements_updated_at
  BEFORE UPDATE ON public.salary_disbursements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. INCENTIVE POCKET (overtime credits)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.incentive_pocket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'overtime',
  hours NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_incentive_pocket_user ON public.incentive_pocket(user_id, reference_date);

ALTER TABLE public.incentive_pocket ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage incentive_pocket" ON public.incentive_pocket
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users view own incentive_pocket" ON public.incentive_pocket
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 4. KYC: extra fields + link to triggering withdrawal
-- ============================================================
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS pan_number TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
  ADD COLUMN IF NOT EXISTS triggered_by_withdrawal_id UUID;

-- ============================================================
-- 5. ATTENDANCE 8h CAP + OVERTIME -> incentive_pocket
-- ============================================================
CREATE OR REPLACE FUNCTION public.attendance_cap_8h()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_end TIMESTAMPTZ;
  worked_hours NUMERIC;
  overtime_hours NUMERIC;
BEGIN
  IF NEW.check_in_at IS NOT NULL AND NEW.check_out_at IS NOT NULL THEN
    max_end := NEW.check_in_at + INTERVAL '8 hours';
    IF NEW.check_out_at > max_end THEN
      overtime_hours := EXTRACT(EPOCH FROM (NEW.check_out_at - max_end)) / 3600.0;
      NEW.check_out_at := max_end;
      INSERT INTO public.incentive_pocket (user_id, source, hours, reference_date, notes)
      VALUES (NEW.user_id, 'overtime', ROUND(overtime_hours::numeric, 2), NEW.work_date,
              'Auto-credited: session exceeded 8h cap');
    END IF;
    worked_hours := EXTRACT(EPOCH FROM (NEW.check_out_at - NEW.check_in_at)) / 3600.0;
    NEW.hours_worked := ROUND(worked_hours::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_cap_8h_trg ON public.attendance;
CREATE TRIGGER attendance_cap_8h_trg
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.attendance_cap_8h();

-- ============================================================
-- 6. WITHDRAWAL MIN ₹5,000 (validation trigger, not CHECK)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_withdrawal_minimum()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount < 5000 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is ₹5,000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_withdrawal_minimum_trg ON public.withdrawals;
CREATE TRIGGER validate_withdrawal_minimum_trg
  BEFORE INSERT ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.validate_withdrawal_minimum();
