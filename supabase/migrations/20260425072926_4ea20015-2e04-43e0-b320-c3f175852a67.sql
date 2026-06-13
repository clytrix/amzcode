
-- Drop existing client-side insert/update policies that allowed fee_paid status
DROP POLICY IF EXISTS "users insert own kyc" ON public.kyc_submissions;
DROP POLICY IF EXISTS "users update own kyc" ON public.kyc_submissions;

-- Restrict INSERT to not_started only
CREATE POLICY "users insert own kyc"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'not_started'::kyc_status
  AND fee_paid_at IS NULL
  AND fee_payment_reference IS NULL
);

-- Restrict UPDATE: users can update their KYC details but not payment fields,
-- and only transition status to 'documents_submitted' (or keep current status while editing).
-- Payment-driven transitions to 'fee_paid' / approval must go through server-side functions.
CREATE POLICY "users update own kyc"
ON public.kyc_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status IN ('not_started'::kyc_status, 'rejected'::kyc_status))
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('not_started'::kyc_status, 'rejected'::kyc_status)
);

-- Cached FX rate table for USD->INR (server-managed)
CREATE TABLE IF NOT EXISTS public.fx_rates (
  base text NOT NULL,
  quote text NOT NULL,
  rate numeric NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (base, quote)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read fx_rates"
ON public.fx_rates
FOR SELECT
TO anon, authenticated
USING (true);

-- No insert/update/delete for clients; only service role / server functions can write.
