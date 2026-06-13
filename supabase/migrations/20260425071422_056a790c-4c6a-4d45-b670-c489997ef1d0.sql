-- 1. KYC: replace permissive UPDATE policy with one that restricts which status values a user can set
DROP POLICY IF EXISTS "users update own kyc" ON public.kyc_submissions;
CREATE POLICY "users update own kyc"
ON public.kyc_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('fee_paid'::kyc_status, 'documents_submitted'::kyc_status)
);

-- Allow users to insert their own KYC row (with safe status only)
CREATE POLICY "users insert own kyc"
ON public.kyc_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('not_started'::kyc_status, 'fee_paid'::kyc_status)
);

-- 2. User roles: explicit RESTRICTIVE deny so only admins (via the existing permissive admin-manage policy) can write
CREATE POLICY "deny non-admin role insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny non-admin role update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny non-admin role delete"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Withdrawals: tighten INSERT to require approved KYC server-side
DROP POLICY IF EXISTS "users create own withdrawals" ON public.withdrawals;
CREATE POLICY "users create own withdrawals"
ON public.withdrawals
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.kyc_submissions
    WHERE user_id = auth.uid() AND status = 'approved'::kyc_status
  )
);