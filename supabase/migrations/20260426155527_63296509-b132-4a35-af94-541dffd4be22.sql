
-- Create private kyc-documents bucket for ID/selfie uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for kyc-documents bucket — users can upload/view their own files
-- Files are stored at path: <user_id>/<filename>

CREATE POLICY "Users can upload own KYC documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own KYC documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users can update own KYC documents while editable"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own KYC documents while editable"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update document_front_url, document_back_url, selfie_url
-- on their own KYC submission while in not_started or rejected state.
-- The existing "users update own kyc" policy already allows this for those statuses,
-- but its WITH CHECK forces fee_paid_at IS NULL etc. — so as long as those stay
-- null, document URL updates are allowed. No change needed there.

-- Index to fetch overdue / due-soon tasks quickly (already exists from earlier migration if any)
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_status ON public.tasks (deadline, status)
  WHERE status IN ('assigned', 'in_progress');
