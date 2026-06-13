-- Tighten KYC update policy to prevent any client-side status changes.
-- All status transitions must go through server-side functions (processKycPayment, admin review).
DROP POLICY IF EXISTS "users update own kyc" ON public.kyc_submissions;

CREATE POLICY "users update own kyc"
ON public.kyc_submissions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND status = ANY (ARRAY['not_started'::kyc_status, 'rejected'::kyc_status])
)
WITH CHECK (
  auth.uid() = user_id
  -- New status must equal the existing status: clients cannot change status at all.
  AND status = (SELECT k.status FROM public.kyc_submissions k WHERE k.id = kyc_submissions.id)
  -- Clients cannot mark fees as paid either.
  AND fee_paid_at IS NULL
  AND fee_payment_reference IS NULL
  -- Clients cannot self-approve or alter admin review fields.
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND admin_notes IS NULL
);