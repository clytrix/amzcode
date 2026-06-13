-- Platform settings: key/value store. Public settings readable by anyone; private only by admins.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can read public settings (telegram widget, custom code, branding, kyc on/off, withdrawal limits display)
CREATE POLICY "anyone read public settings"
  ON public.platform_settings FOR SELECT
  USING (is_public = true);

-- Admins can read all settings
CREATE POLICY "admins read all settings"
  ON public.platform_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert/update/delete
CREATE POLICY "admins insert settings"
  ON public.platform_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update settings"
  ON public.platform_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete settings"
  ON public.platform_settings FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed defaults
INSERT INTO public.platform_settings (key, value, is_public, description) VALUES
  ('site.branding', '{"site_name":"AMZ.Jobs","tagline":"Remote Work From Home Jobs","support_email":"support@AMZ.Jobs"}'::jsonb, true, 'Site branding'),
  ('kyc.config', '{"enabled":true,"fee_usd":79,"required_for_withdrawal":true}'::jsonb, true, 'KYC settings'),
  ('withdrawals.config', '{"enabled":true,"min_amount":5000,"max_amount":500000,"daily_limit":100000}'::jsonb, true, 'Withdrawal limits'),
  ('email.zeptomail', '{"from_email":"","from_name":"AMZ.Jobs","region":"in","enabled":true}'::jsonb, false, 'ZeptoMail config (token stays in secret)'),
  ('telegram.widget', '{"enabled":false,"bot_username":"","welcome_message":"Hi! How can we help?","position":"bottom-right"}'::jsonb, true, 'Telegram support widget'),
  ('custom.code', '{"head_html":"","body_end_html":"","analytics_id":""}'::jsonb, true, 'Custom code injection'),
  ('site.maintenance', '{"enabled":false,"message":"We are performing scheduled maintenance. Please check back soon."}'::jsonb, true, 'Maintenance mode'),
  ('site.signup', '{"enabled":true,"require_email_verification":true}'::jsonb, true, 'Signup configuration')
ON CONFLICT (key) DO NOTHING;