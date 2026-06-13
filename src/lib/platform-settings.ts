import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Default values mirror the seeded DB rows so the UI works even if the table read fails.
export const DEFAULT_SETTINGS = {
  "site.branding": { site_name: "AMZ.Jobs", tagline: "Remote Work From Home Jobs", support_email: "support@AMZ.Jobs" },
  "kyc.config": { enabled: true, fee_usd: 79, required_for_withdrawal: true },
  "withdrawals.config": { enabled: true, min_amount: 5000, max_amount: 500000, daily_limit: 100000 },
  "telegram.widget": { enabled: false, bot_username: "", welcome_message: "Hi! How can we help?", position: "bottom-right" },
  "custom.code": { head_html: "", body_end_html: "", analytics_id: "" },
  "site.suspended": { enabled: false, reason: "This website has been suspended for spamming and abusing Clytrix Terms of Service.", contact_telegram: "clytrix" },
  "site.maintenance": { enabled: false, message: "We are performing scheduled maintenance. Please check back soon." },
  "site.signup": { enabled: true, require_email_verification: true },
  "payments.upi": { qr_image_url: "", upi_id: "", payee_name: "", instructions: "Scan the QR or pay to the UPI ID. After paying, copy the UTR / Transaction reference and submit it below.", usd_to_inr_rate: 94 },
} as const;

export type PublicSettings = typeof DEFAULT_SETTINGS;

let cache: PublicSettings | null = null;
let inflight: Promise<PublicSettings> | null = null;

async function fetchPublicSettings(): Promise<PublicSettings> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase.from("platform_settings").select("key,value").eq("is_public", true);
    const merged: any = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    for (const row of data ?? []) {
      if (row.key in merged) merged[row.key] = { ...merged[row.key], ...(row.value as any) };
    }
    cache = merged;
    return merged;
  })();
  const res = await inflight;
  inflight = null;
  return res;
}

export function invalidatePublicSettingsCache() {
  cache = null;
}

export function usePublicSettings() {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    fetchPublicSettings().then((s) => {
      if (mounted) {
        setSettings(s);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);
  return { settings, loading };
}
