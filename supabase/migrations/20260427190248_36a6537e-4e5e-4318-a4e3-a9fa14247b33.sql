-- DAILY POOL must exist before invoices policy that references it.
CREATE TABLE IF NOT EXISTS public.data_entry_daily_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'))::date,
  invoice_id uuid NOT NULL,
  reward_amount numeric NOT NULL DEFAULT 150,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_date, invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_pool_date ON public.data_entry_daily_pool(pool_date);

CREATE TABLE IF NOT EXISTS public.data_entry_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL,
  invoice_number text NOT NULL,
  invoice_date date,
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  gst_number text,
  image_url text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK now that both tables exist
ALTER TABLE public.data_entry_daily_pool
  DROP CONSTRAINT IF EXISTS data_entry_daily_pool_invoice_id_fkey;
ALTER TABLE public.data_entry_daily_pool
  ADD CONSTRAINT data_entry_daily_pool_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.data_entry_invoices(id) ON DELETE CASCADE;

ALTER TABLE public.data_entry_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_entry_daily_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage data_entry_invoices" ON public.data_entry_invoices
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "employees view active invoices in todays pool" ON public.data_entry_invoices
  FOR SELECT USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.data_entry_daily_pool p
      WHERE p.invoice_id = data_entry_invoices.id
        AND p.pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'))::date
    )
  );

CREATE POLICY "admins manage daily_pool" ON public.data_entry_daily_pool
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "employees view current pool" ON public.data_entry_daily_pool
  FOR SELECT USING (pool_date = ((now() AT TIME ZONE 'Asia/Kolkata'))::date);

-- SUBMISSIONS
CREATE TABLE IF NOT EXISTS public.data_entry_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pool_id uuid NOT NULL REFERENCES public.data_entry_daily_pool(id) ON DELETE CASCADE,
  pool_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata'))::date,
  vendor_name text,
  invoice_number text,
  invoice_date date,
  amount numeric,
  tax_amount numeric,
  gst_number text,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  reward_credited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pool_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_user_date ON public.data_entry_submissions(user_id, pool_date);

ALTER TABLE public.data_entry_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage submissions" ON public.data_entry_submissions
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "users view own submissions" ON public.data_entry_submissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own submissions" ON public.data_entry_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND reward_credited = false);
CREATE POLICY "users update own open submissions" ON public.data_entry_submissions
  FOR UPDATE USING (auth.uid() = user_id AND reward_credited = false)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_de_subs_updated ON public.data_entry_submissions;
CREATE TRIGGER trg_de_subs_updated BEFORE UPDATE ON public.data_entry_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_de_inv_updated ON public.data_entry_invoices;
CREATE TRIGGER trg_de_inv_updated BEFORE UPDATE ON public.data_entry_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Unique reference for idempotent wallet credits
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ux_wallet_tx_reference'
  ) THEN
    CREATE UNIQUE INDEX ux_wallet_tx_reference
      ON public.wallet_transactions(reference) WHERE reference IS NOT NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.credit_data_entry_reward()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE reward numeric; ref text;
BEGIN
  IF NEW.is_done = true AND COALESCE(OLD.is_done, false) = false AND NEW.reward_credited = false THEN
    SELECT reward_amount INTO reward FROM public.data_entry_daily_pool WHERE id = NEW.pool_id;
    reward := COALESCE(reward, 150);
    ref := 'dataentry:' || NEW.id::text;
    INSERT INTO public.wallets (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
    BEGIN
      INSERT INTO public.wallet_transactions (user_id, wallet, amount, type, reference, description)
      VALUES (NEW.user_id, 'incentive', reward, 'credit', ref, 'Data-entry task reward');
    EXCEPTION WHEN unique_violation THEN NULL; END;
    NEW.reward_credited := true;
    NEW.done_at := COALESCE(NEW.done_at, now());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_credit_data_entry ON public.data_entry_submissions;
CREATE TRIGGER trg_credit_data_entry BEFORE UPDATE ON public.data_entry_submissions
  FOR EACH ROW EXECUTE FUNCTION public.credit_data_entry_reward();

CREATE OR REPLACE FUNCTION public.accrue_daily_salary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE today date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date;
        pkg record; daily numeric; ref text; credited int := 0; skipped int := 0;
BEGIN
  FOR pkg IN
    SELECT user_id, monthly_salary FROM public.employment_packages
    WHERE is_active = true AND starts_on <= today AND (ends_on IS NULL OR ends_on >= today)
  LOOP
    daily := ROUND(COALESCE(pkg.monthly_salary, 0) / 30.0, 2);
    IF daily <= 0 THEN CONTINUE; END IF;
    ref := 'salary:' || pkg.user_id::text || ':' || to_char(today, 'YYYY-MM-DD');
    INSERT INTO public.wallets (user_id) VALUES (pkg.user_id) ON CONFLICT (user_id) DO NOTHING;
    BEGIN
      INSERT INTO public.wallet_transactions (user_id, wallet, amount, type, reference, description)
      VALUES (pkg.user_id, 'salary', daily, 'credit', ref, 'Daily salary accrual ' || to_char(today,'YYYY-MM-DD'));
      credited := credited + 1;
    EXCEPTION WHEN unique_violation THEN skipped := skipped + 1; END;
  END LOOP;
  RETURN jsonb_build_object('date', today, 'credited', credited, 'skipped', skipped);
END; $$;

CREATE OR REPLACE FUNCTION public.rollover_data_entry_pool()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE today date := ((now() AT TIME ZONE 'Asia/Kolkata'))::date; inserted int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.data_entry_daily_pool WHERE pool_date = today) THEN
    RETURN jsonb_build_object('date', today, 'inserted', 0, 'skipped', true);
  END IF;
  INSERT INTO public.data_entry_daily_pool (pool_date, invoice_id, position)
  SELECT today, id, ROW_NUMBER() OVER (ORDER BY random()) - 1
  FROM public.data_entry_invoices WHERE is_active = true
  ORDER BY random() LIMIT 30;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN jsonb_build_object('date', today, 'inserted', inserted);
END; $$;