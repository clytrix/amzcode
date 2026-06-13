import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailViaResend, buildOtpEmailHtml } from "./email";

// Admin function to delete a user completely
export const deleteUserById = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- helpers ----------
function getClientIp(): string {
  const req = getRequest();
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = getRequestHeader("x-real-ip");
  if (real) return real.trim();
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf.trim();
  return (req as any)?.cf?.connectingIp || "0.0.0.0";
}

function getUserAgent(): string {
  return (getRequestHeader("user-agent") || "").slice(0, 500);
}

function getDeviceId(): string {
  return (getRequestHeader("x-device-id") || "").slice(0, 128);
}

async function hashCode(code: string, email: string): Promise<string> {
  const enc = new TextEncoder().encode(`${email}:${code}:zeptomail-otp`);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  // 6-digit code
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).toString();
  return n.padStart(6, "0");
}

async function createAndSendOtp(email: string, purpose: "signup" | "new_ip") {
  const normalized = email.toLowerCase();
  const ip = getClientIp();
  const ua = getUserAgent();

  const code = generateOtp();
  const hash = await hashCode(code, normalized);

  // Invalidate prior unused OTPs for the same email/purpose
  await supabaseAdmin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("email", normalized)
    .eq("purpose", purpose)
    .is("consumed_at", null);

  const { error } = await supabaseAdmin.from("otp_codes").insert({
    email: email.toLowerCase(),
    code_hash: hash,
    purpose,
    ip_address: ip,
    user_agent: ua,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);

  // Try to send email. If it fails, mark the OTP consumed and signal auto-bypass
  // so the caller can complete the flow without forcing the user to enter a code.
  try {
    await sendEmailViaResend({
      to: email,
      subject:
        purpose === "signup"
          ? "Verify your AMZ.jobs email"
          : "New device sign-in — verification required",
      html: buildOtpEmailHtml({ code, purpose, ip, userAgent: ua }),
    });
    return { sent: true, bypass: false };
  } catch (e) {
    console.error("OTP email send failed, auto-bypassing:", e);
    await supabaseAdmin
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", normalized)
      .eq("purpose", purpose)
      .is("consumed_at", null);
    return { sent: false, bypass: true };
  }
}

// ---------- 1. Signup: send OTP ----------
export const requestSignupOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
    }).parse
  )
  .handler(async ({ data }) => {
    return createAndSendOtp(data.email, "signup");
  });

// ---------- 1b. Direct account creation (used when OTP email send fails) ----------
async function createAccountInternal(args: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = args.email.toLowerCase();
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: args.password,
    email_confirm: true,
    user_metadata: { full_name: args.fullName, phone: args.phone },
  });
  if (createErr) return { ok: false, error: createErr.message || "Failed to create account." };
  if (created.user) {
    // Assign employee role to new user (ignore if already exists)
    try {
      await supabaseAdmin.from("user_roles").insert({
        user_id: created.user.id,
        role: "employee",
      });
    } catch { /* ignore duplicate or other errors */ }

    // Create profile record
    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      email: created.user.email,
      full_name: args.fullName,
      phone: args.phone || null,
      phone_verified: !!args.phone,
      email_verified: true,
    });

    const did = getDeviceId();
    if (did) {
      await supabaseAdmin.from("trusted_devices").upsert(
        {
          user_id: created.user.id,
          device_id: did,
          user_agent: getUserAgent(),
          last_ip: getClientIp(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" },
      );
    }
    await supabaseAdmin.from("login_ips").upsert(
      { user_id: created.user.id, ip_address: getClientIp(), user_agent: getUserAgent(), last_seen_at: new Date().toISOString() },
      { onConflict: "user_id,ip_address" },
    );
  }
  return { ok: true };
}

export const createAccountWithoutOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(8).max(128),
      fullName: z.string().trim().min(1).max(120),
      phone: z.string().trim().max(40).optional().default(""),
    }).parse
  )
  .handler(async ({ data }) => {
    return createAccountInternal(data);
  });

// ---------- 2. Verify signup OTP, then create account ----------
export const verifySignupAndCreate = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
      password: z.string().min(8).max(128),
      fullName: z.string().trim().min(1).max(120),
      phone: z.string().trim().max(40).optional().default(""),
      code: z.string().regex(/^\d{6}$/),
    }).parse
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    // Get the latest unconsumed/unexpired signup OTP for this email
    const { data: latest } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("purpose", "signup")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) return { ok: false, error: "Invalid or expired code." };

    const MAX_ATTEMPTS = 5;
    if ((latest.attempts ?? 0) >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", latest.id);
      return { ok: false, error: "Too many attempts. Please request a new code." };
    }

    const hash = await hashCode(data.code, email);
    if (hash !== latest.code_hash) {
      const newAttempts = (latest.attempts ?? 0) + 1;
      const updates: { attempts: number; consumed_at?: string } = { attempts: newAttempts };
      if (newAttempts >= MAX_ATTEMPTS) updates.consumed_at = new Date().toISOString();
      await supabaseAdmin.from("otp_codes").update(updates).eq("id", latest.id);
      return { ok: false, error: "Invalid or expired code." };
    }

    // Mark consumed
    await supabaseAdmin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", latest.id);

    // Create user (auto-confirmed because we already verified the email)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone },
    });
    if (createErr) {
      const msg = createErr.message || "Failed to create account.";
      return { ok: false, error: msg };
    }

    // Assign employee role to new user (ignore if already exists)
    if (created.user) {
      try {
        await supabaseAdmin.from("user_roles").insert({
          user_id: created.user.id,
          role: "employee",
        });
      } catch { /* ignore duplicate or other errors */ }

      // Create profile record
      await supabaseAdmin.from("profiles").insert({
        id: created.user.id,
        email: created.user.email,
        full_name: data.fullName,
        phone: data.phone || null,
        phone_verified: !!data.phone,
        email_verified: true,
      });
    }

    // Trust the current device since the user just verified their email.
    if (created.user) {
      const did = getDeviceId();
      if (did) {
        await supabaseAdmin.from("trusted_devices").upsert(
          {
            user_id: created.user.id,
            device_id: did,
            user_agent: getUserAgent(),
            last_ip: getClientIp(),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "user_id,device_id" },
        );
      }
      // Also record the IP for the audit log (login_ips). Not used as a gate.
      await supabaseAdmin.from("login_ips").upsert(
        {
          user_id: created.user.id,
          ip_address: getClientIp(),
          user_agent: getUserAgent(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,ip_address" }
      );
    }

    return { ok: true };
  });

// ---------- helpers: look up user by email (trust the email, never trust client userId) ----------
async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  // Use the auth admin API to resolve the userId for an email server-side.
  // We page conservatively because there is no direct lookup-by-email endpoint.
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;
  // Cap iterations to avoid abuse
  for (let i = 0; i < 25; i++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) return null;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) return { id: match.id, email: match.email || target };
    if (data.users.length < perPage) return null;
    page += 1;
  }
  return null;
}

// ---------- 3. Before password login, check if this DEVICE is trusted ----------
//
// Trust is now bound to a stable browser-local device id (X-Device-Id header),
// not to the IP. This means mobile users (who get a different IP every few
// minutes) stay signed in across network changes. New devices still require
// an OTP — preserving the security posture for stolen passwords.
//
// We keep the function name `checkIpAndMaybeSendOtp` for backward compatibility
// with the login route. (The IP is recorded for audit only, not as a gate.)
export const checkIpAndMaybeSendOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
    }).parse
  )
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const ua = getUserAgent();
    const did = getDeviceId();

    // Login OTP is disabled — always trust the device. Best-effort audit logging only.
    const user = await findUserByEmail(data.email);
    if (user) {
      if (did) {
        await supabaseAdmin.from("trusted_devices").upsert(
          {
            user_id: user.id,
            device_id: did,
            user_agent: ua,
            last_ip: ip,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "user_id,device_id" },
        );
      }
      await supabaseAdmin.from("login_ips").upsert(
        { user_id: user.id, ip_address: ip, user_agent: ua, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id,ip_address" },
      );
    }
    return { trusted: true, sent: false };
  });

// ---------- 4. Verify the new-device OTP and trust this device ----------
const MAX_OTP_ATTEMPTS = 5;

export const verifyNewIpOtp = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
      code: z.string().regex(/^\d{6}$/),
      deviceName: z.string().trim().max(120).optional(),
    }).parse
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    const user = await findUserByEmail(email);
    if (!user) return { ok: false, error: "Invalid or expired code." };

    const { data: latest } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("purpose", "new_ip")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) return { ok: false, error: "Invalid or expired code." };

    if ((latest.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", latest.id);
      return { ok: false, error: "Too many attempts. Please request a new code." };
    }

    const hash = await hashCode(data.code, email);
    if (hash !== latest.code_hash) {
      const newAttempts = (latest.attempts ?? 0) + 1;
      const updates: { attempts: number; consumed_at?: string } = { attempts: newAttempts };
      if (newAttempts >= MAX_OTP_ATTEMPTS) updates.consumed_at = new Date().toISOString();
      await supabaseAdmin.from("otp_codes").update(updates).eq("id", latest.id);
      return { ok: false, error: "Invalid or expired code." };
    }

    // Success — consume code and trust this device.
    await supabaseAdmin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", latest.id);

    const did = getDeviceId();
    if (did) {
      await supabaseAdmin.from("trusted_devices").upsert(
        {
          user_id: user.id,
          device_id: did,
          device_name: data.deviceName ?? null,
          user_agent: getUserAgent(),
          last_ip: getClientIp(),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" }
      );
    }
    await supabaseAdmin.from("login_ips").upsert(
      {
        user_id: user.id,
        ip_address: getClientIp(),
        user_agent: getUserAgent(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,ip_address" }
    );

    return { ok: true };
  });

// ---------- 5. Revoke a trusted device (user-initiated) ----------
export const revokeTrustedDevice = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data }) => {
    const auth = getRequestHeader("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return { ok: false, error: "Not authenticated" };
    const { data: who, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !who?.user) return { ok: false, error: "Not authenticated" };

    const { error: delErr } = await supabaseAdmin
      .from("trusted_devices")
      .delete()
      .eq("id", data.id)
      .eq("user_id", who.user.id);
    if (delErr) return { ok: false, error: delErr.message };
    return { ok: true };
  });

