-- Trusted devices: stable per-browser identifier the user verified once via OTP.
-- Once a device is trusted, IP changes do not log the user out.
CREATE TABLE IF NOT EXISTS public.trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  device_name text,
  user_agent text,
  last_ip text,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS trusted_devices_user_id_idx ON public.trusted_devices (user_id);
CREATE INDEX IF NOT EXISTS trusted_devices_last_seen_idx ON public.trusted_devices (last_seen_at DESC);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

-- Users can read their own trusted devices.
CREATE POLICY "users view own trusted devices"
ON public.trusted_devices
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can revoke (delete) their own trusted devices.
CREATE POLICY "users delete own trusted devices"
ON public.trusted_devices
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all trusted devices.
CREATE POLICY "admins view all trusted devices"
ON public.trusted_devices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins manage all trusted devices"
ON public.trusted_devices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrictive: clients cannot insert/update directly; only service role does.
CREATE POLICY "deny client insert on trusted_devices"
ON public.trusted_devices
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "deny client update on trusted_devices"
ON public.trusted_devices
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));