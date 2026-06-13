
-- 1. KYC payment columns + new status
ALTER TYPE kyc_status ADD VALUE IF NOT EXISTS 'payment_submitted' BEFORE 'documents_submitted';

ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS payment_utr text,
  ADD COLUMN IF NOT EXISTS payment_inr_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_screenshot_url text;

-- 2. Seed payments.upi public setting
INSERT INTO public.platform_settings (key, value, is_public, description)
VALUES (
  'payments.upi',
  '{"qr_image_url":"","upi_id":"","payee_name":"","instructions":"Scan the QR or pay to the UPI ID. After paying, copy the UTR / Transaction reference and submit it below.","usd_to_inr_rate":94}'::jsonb,
  true,
  'Manual UPI payment configuration for KYC verification fee'
) ON CONFLICT (key) DO NOTHING;

-- 3. payment-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-assets', 'payment-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone read payment-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-assets');

CREATE POLICY "admins write payment-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update payment-assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payment-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins delete payment-assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payment-assets' AND has_role(auth.uid(), 'admin'::app_role));

-- screenshots optional: allow users to upload to kyc-documents (already exists) — no new bucket needed

-- 4. Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY,
  salary_balance numeric NOT NULL DEFAULT 0,
  incentive_balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins view all wallets"
  ON public.wallets FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins manage wallets"
  ON public.wallets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Deny client direct insert/update — only service role / admin
CREATE POLICY "deny client insert wallets"
  ON public.wallets AS RESTRICTIVE FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client update wallets"
  ON public.wallets AS RESTRICTIVE FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5. Wallet transactions (immutable ledger)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet text NOT NULL CHECK (wallet IN ('salary','incentive')),
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('credit','debit','withdrawal','refund','adjustment')),
  reference text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_reference_unique
  ON public.wallet_transactions (reference) WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS wallet_tx_user_created_idx
  ON public.wallet_transactions (user_id, created_at DESC);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own wallet tx"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins view all wallet tx"
  ON public.wallet_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins manage wallet tx"
  ON public.wallet_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny client insert wallet tx"
  ON public.wallet_transactions AS RESTRICTIVE FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "deny client update wallet tx"
  ON public.wallet_transactions AS RESTRICTIVE FOR UPDATE
  USING (false) WITH CHECK (false);
CREATE POLICY "deny client delete wallet tx"
  ON public.wallet_transactions AS RESTRICTIVE FOR DELETE
  USING (false);

-- 6. Trigger: when a wallet_transactions row is inserted, update wallets balance
CREATE OR REPLACE FUNCTION public.apply_wallet_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric;
BEGIN
  -- Ensure wallet row exists
  INSERT INTO public.wallets (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.type IN ('credit','refund') THEN
    delta := NEW.amount;
  ELSIF NEW.type IN ('debit','withdrawal') THEN
    delta := -NEW.amount;
  ELSE -- adjustment can be signed
    delta := NEW.amount;
  END IF;

  IF NEW.wallet = 'salary' THEN
    UPDATE public.wallets SET salary_balance = salary_balance + delta, updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSE
    UPDATE public.wallets SET incentive_balance = incentive_balance + delta, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_wallet_tx ON public.wallet_transactions;
CREATE TRIGGER apply_wallet_tx
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_transaction();

-- 7. Backfill wallets for existing users
INSERT INTO public.wallets (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 8. Update handle_new_user to also create a wallet
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  INSERT INTO public.kyc_submissions (user_id, status) VALUES (NEW.id, 'not_started');
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- 9. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
