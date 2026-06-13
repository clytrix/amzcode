-- Make payment-assets bucket private
UPDATE storage.buckets SET public = false WHERE id = 'payment-assets';

-- Drop any existing permissive policies on payment-assets to start clean
DROP POLICY IF EXISTS "payment-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read payment-assets" ON storage.objects;
DROP POLICY IF EXISTS "payment_assets_public_select" ON storage.objects;

-- Users can view their own payment assets (files stored under {user_id}/...)
CREATE POLICY "users view own payment-assets"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can upload their own payment assets
CREATE POLICY "users upload own payment-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own payment assets
CREATE POLICY "users update own payment-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'payment-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can manage all payment assets
CREATE POLICY "admins manage payment-assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'payment-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  bucket_id = 'payment-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);