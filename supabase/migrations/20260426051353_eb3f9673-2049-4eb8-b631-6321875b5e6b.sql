-- 1) OTP codes: convert permissive false policies to RESTRICTIVE false policies
DROP POLICY IF EXISTS "deny all client select on otp" ON public.otp_codes;
DROP POLICY IF EXISTS "deny all client insert on otp" ON public.otp_codes;
DROP POLICY IF EXISTS "deny all client update on otp" ON public.otp_codes;
DROP POLICY IF EXISTS "deny all client delete on otp" ON public.otp_codes;

CREATE POLICY "restrictive deny client select on otp"
ON public.otp_codes
AS RESTRICTIVE
FOR SELECT
TO public
USING (false);

CREATE POLICY "restrictive deny client insert on otp"
ON public.otp_codes
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "restrictive deny client update on otp"
ON public.otp_codes
AS RESTRICTIVE
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "restrictive deny client delete on otp"
ON public.otp_codes
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);

-- 2) KYC submissions: enforce fee_amount = 79 on user insert
DROP POLICY IF EXISTS "users insert own kyc" ON public.kyc_submissions;

CREATE POLICY "users insert own kyc"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'not_started'::kyc_status
  AND fee_paid_at IS NULL
  AND fee_payment_reference IS NULL
  AND fee_amount = 79
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND admin_notes IS NULL
);

-- 3) Withdrawals: explicit restrictive rule so users can never UPDATE/DELETE their withdrawals
CREATE POLICY "restrictive deny user update withdrawals"
ON public.withdrawals
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "restrictive deny user delete withdrawals"
ON public.withdrawals
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));