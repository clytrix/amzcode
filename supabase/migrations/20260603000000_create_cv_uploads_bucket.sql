-- Create private cv-uploads bucket for job application CV/resume uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('cv-uploads', 'cv-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for cv-uploads bucket — users can upload/view their own CVs
-- Files are stored at path: <user_id>/<jobId>-<timestamp>.<ext>

CREATE POLICY "Users can upload own CVs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cv-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own CVs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cv-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own CVs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'cv-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own CVs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cv-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
