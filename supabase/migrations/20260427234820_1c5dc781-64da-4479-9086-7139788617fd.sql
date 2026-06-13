-- Create dedicated public bucket for the UPI QR code (admin-managed branding asset)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qr', 'payment-qr', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read the QR (it's intentionally public)
CREATE POLICY "anyone read payment-qr"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'payment-qr');

-- Only admins can upload/replace/delete the QR
CREATE POLICY "admins manage payment-qr"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'payment-qr' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'payment-qr' AND has_role(auth.uid(), 'admin'::app_role));