-- Fix function search_path warnings
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Explicit deny policies for otp_codes (server/service-role only)
CREATE POLICY "deny all client select on otp" ON public.otp_codes FOR SELECT USING (false);
CREATE POLICY "deny all client insert on otp" ON public.otp_codes FOR INSERT WITH CHECK (false);
CREATE POLICY "deny all client update on otp" ON public.otp_codes FOR UPDATE USING (false);
CREATE POLICY "deny all client delete on otp" ON public.otp_codes FOR DELETE USING (false);

-- Allow users to see if their own login_ip exists (already have select); add insert/update via server only
-- (login_ips will be written by server function with service role)
