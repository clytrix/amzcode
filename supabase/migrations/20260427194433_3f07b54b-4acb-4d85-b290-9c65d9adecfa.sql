
-- 1) Restrict daily pool SELECT to authenticated users
DROP POLICY IF EXISTS "employees view current pool" ON public.data_entry_daily_pool;
CREATE POLICY "employees view current pool"
  ON public.data_entry_daily_pool
  FOR SELECT
  TO authenticated
  USING (pool_date = ((now() AT TIME ZONE 'Asia/Kolkata')::date));

-- 2) Tighten KYC update policy: prevent users from changing status, fee fields,
--    review fields, and identity/bank fields after initial save by locking them
--    to their previously stored values via a subquery.
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
    AND status = (SELECT k.status FROM public.kyc_submissions k WHERE k.id = kyc_submissions.id)
    AND fee_paid_at IS NULL
    AND fee_payment_reference IS NULL
    AND payment_utr IS NULL
    AND payment_inr_amount IS NULL
    AND payment_submitted_at IS NULL
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND admin_notes IS NULL
    AND fee_amount = 79
    AND triggered_by_withdrawal_id IS NOT DISTINCT FROM
        (SELECT k.triggered_by_withdrawal_id FROM public.kyc_submissions k WHERE k.id = kyc_submissions.id)
  );

-- 3) Revoke EXECUTE on SECURITY DEFINER admin/internal functions from PUBLIC and authenticated.
--    Trigger functions don't need direct EXECUTE rights — triggers run as table owner.
REVOKE ALL ON FUNCTION public.accrue_daily_salary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollover_data_entry_pool() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_wallet_transaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attendance_cap_8h() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_data_entry_reward() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_withdrawal_minimum() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_function_security() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_security_report() FROM PUBLIC, anon, authenticated;
-- has_role, is_project_member, has_approved_application are used inside RLS policies — keep authenticated EXECUTE
-- but ensure they have built-in caller checks (has_role/is_project_member already do).

-- 4) Remove broad SELECT (listing) policy on public payment-assets bucket.
--    Public buckets still serve files directly via URL without SELECT policy.
DROP POLICY IF EXISTS "anyone read payment-assets" ON storage.objects;
