import { supabaseAdmin } from "@/integrations/supabase/client.server";

const APITXT_KEY = "JY-BskzSBZH0vhbhGM1V4oMb0F3BRTDP3qvtNIVCq50";
const APITXT_OTP_URL = "https://apitxt.com/api/sendOTP";

// ─── helpers ─────────────────────────────────────────────────────────────────

export function generateOtp(): string {
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).toString();
  return n.padStart(6, "0");
}

/** Normalise Indian mobile: strip +/spaces, auto-prepend 91 if 10 digits */
export function normaliseMobile(raw: string): string {
  let m = raw.replace(/[\s\-().+]/g, "");
  if (m.startsWith("0")) m = m.slice(1);
  if (m.length === 10) m = "91" + m;
  return m;
}

/** Validate Indian mobile (10 digit starting 6-9, with or without 91 prefix) */
export function isValidIndianMobile(raw: string): boolean {
  const m = raw.replace(/[\s\-().+]/g, "");
  const digits = m.startsWith("91") && m.length === 12 ? m.slice(2) : m;
  return /^[6-9]\d{9}$/.test(digits);
}

export async function hashCode(code: string, key: string): Promise<string> {
  const enc = new TextEncoder().encode(`${key}:${code}:sms-otp-amz`);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Send OTP via apitxt SMS */
export async function sendSmsOtp(mobile: string, otp: string): Promise<boolean> {
  try {
    const res = await fetch(APITXT_OTP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authkey: APITXT_KEY, mobile, otp, channel: "sms", country: "91" }),
    });
    const json: any = await res.json().catch(() => ({}));
    console.log("[SMS OTP]", mobile, json);
    return json?.status === "success";
  } catch (e) {
    console.error("[SMS OTP] fetch error", e);
    return false;
  }
}

export async function createAndSendSmsOtp(
  mobile: string,
  purpose: "signup" | "login" | "forgot",
): Promise<{ sent: boolean }> {
  const otp = generateOtp();
  const hash = await hashCode(otp, mobile);

  const otpTable = supabaseAdmin.from("otp_codes") as any;
  await otpTable
    .update({ consumed_at: new Date().toISOString() })
    .eq("mobile", mobile)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const insertTable = supabaseAdmin.from("otp_codes") as any;
  const { error } = await insertTable.insert({
    email: mobile,
    mobile,
    code_hash: hash,
    purpose,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error("Failed to store OTP: " + (error as any).message);

  const sent = await sendSmsOtp(mobile, otp);
  return { sent };
}

export async function verifySmsOtp(
  mobile: string,
  code: string,
  purpose: "signup" | "login" | "forgot",
): Promise<{ ok: boolean; error?: string }> {
  const selectTable = supabaseAdmin.from("otp_codes") as any;
  const { data: latest } = await selectTable
    .select("*")
    .eq("mobile", mobile)
    .eq("purpose", purpose)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return { ok: false, error: "OTP expired or not found. Request a new one." };

  const MAX = 5;
  if ((latest.attempts ?? 0) >= MAX) {
    await supabaseAdmin
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", latest.id);
    return { ok: false, error: "Too many attempts. Please request a new OTP." };
  }

  const hash = await hashCode(code, mobile);
  if (hash !== latest.code_hash) {
    const newAttempts = (latest.attempts ?? 0) + 1;
    const updates: any = { attempts: newAttempts };
    if (newAttempts >= MAX) updates.consumed_at = new Date().toISOString();
    await supabaseAdmin.from("otp_codes").update(updates).eq("id", latest.id);
    const left = MAX - newAttempts;
    return {
      ok: false,
      error: `Incorrect OTP. ${left > 0 ? `${left} attempt(s) left.` : "Please request a new OTP."}`,
    };
  }

  await supabaseAdmin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", latest.id);

  return { ok: true };
}

export async function findUserByMobile(
  mobile: string,
): Promise<{ id: string; email: string; phone: string } | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, phone")
    .eq("phone", mobile)
    .maybeSingle();
  if (data) return data as any;

  const tenDigit = mobile.startsWith("91") && mobile.length === 12 ? mobile.slice(2) : mobile;
  if (tenDigit !== mobile) {
    const { data: d2 } = await supabaseAdmin
      .from("profiles")
      .select("id, email, phone")
      .eq("phone", tenDigit)
      .maybeSingle();
    if (d2) return d2 as any;
  }
  return null;
}

export async function findUserByEmail(
  email: string,
): Promise<{ id: string; email: string; phone: string | null } | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, phone")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return (data as any) || null;
}
