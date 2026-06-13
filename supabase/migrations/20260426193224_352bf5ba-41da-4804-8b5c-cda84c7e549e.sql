-- 1. Harden is_project_member to only answer for the calling user
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL OR auth.uid() <> _user_id THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = _project_id AND user_id = _user_id
      )
    END
$$;

-- 2. Restrict KYC document storage edits/deletes to editable submission states
DROP POLICY IF EXISTS "Users can update own KYC documents while editable" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own KYC documents while editable" ON storage.objects;

CREATE POLICY "Users can update own KYC documents while editable"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.kyc_submissions k
    WHERE k.user_id = auth.uid()
      AND k.status IN ('not_started'::kyc_status, 'rejected'::kyc_status)
  )
)
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.kyc_submissions k
    WHERE k.user_id = auth.uid()
      AND k.status IN ('not_started'::kyc_status, 'rejected'::kyc_status)
  )
);

CREATE POLICY "Users can delete own KYC documents while editable"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM public.kyc_submissions k
    WHERE k.user_id = auth.uid()
      AND k.status IN ('not_started'::kyc_status, 'rejected'::kyc_status)
  )
);

-- 3. Add an explicit RESTRICTIVE deny on client INSERT into credential_access_log
-- Inserts from app code go through service-role (supabaseAdmin) which bypasses RLS,
-- so this is purely defense-in-depth against accidental future permissive policies.
CREATE POLICY "restrictive deny client insert on credential_access_log"
ON public.credential_access_log
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "restrictive deny client update on credential_access_log"
ON public.credential_access_log
AS RESTRICTIVE
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "restrictive deny client delete on credential_access_log"
ON public.credential_access_log
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);
