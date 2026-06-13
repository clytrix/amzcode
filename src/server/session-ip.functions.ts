// Lightweight, non-disruptive session check.
//
// Previous behaviour: hard-logout on every new IP. That punished mobile users
// whose carrier IPs rotate constantly (cellular, Wi-Fi switches, VPNs).
//
// New behaviour: trust is bound to the *device* (a stable id stored in the
// browser's localStorage and sent via the X-Device-Id header), not to the IP.
// Once a device is verified, the user stays signed in across IP changes.
//
// This server function is now used to:
//   * Refresh `last_seen_at` on the trusted device record (lightweight ping).
//   * Capture the latest IP/user-agent for audit visibility.
//   * Return `trusted: true` so the client never auto-signs-out on its own.
//
// The actual "is this device trusted?" gate happens at LOGIN time
// (see `checkDeviceAndMaybeSendOtp` in auth.functions.ts). After login, the
// session is allowed to persist normally — Supabase handles refresh tokens.

import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function ip(): string {
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = getRequestHeader("x-real-ip");
  if (real) return real.trim();
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf.trim();
  return ((getRequest() as any)?.cf?.connectingIp || "0.0.0.0");
}
function ua(): string { return (getRequestHeader("user-agent") || "").slice(0, 500); }
function deviceId(): string { return (getRequestHeader("x-device-id") || "").slice(0, 128); }

export const enforceSessionIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const currentIp = ip();
    const currentUa = ua();
    const currentDevice = deviceId();

    // No device id yet (e.g. first load before bootstrap completes) — treat as
    // trusted. We never want to log a user out from a transient header miss.
    if (!currentDevice) {
      return { trusted: true, reason: "no-device-id" as const };
    }

    // Look up the device. If present, just refresh the last-seen timestamp so
    // the user can revoke stale devices later from a settings screen.
    const { data: device } = await supabaseAdmin
      .from("trusted_devices")
      .select("id")
      .eq("user_id", userId)
      .eq("device_id", currentDevice)
      .maybeSingle();

    if (device) {
      await supabaseAdmin
        .from("trusted_devices")
        .update({
          last_seen_at: new Date().toISOString(),
          last_ip: currentIp,
          user_agent: currentUa,
        })
        .eq("id", device.id);
      return { trusted: true, reason: "device-known" as const };
    }

    // Device not yet recorded for this user — auto-trust this session because
    // it carries a valid Supabase access token (already verified by middleware).
    // This handles the "first time after upgrade" case where existing logged-in
    // users wouldn't have a device record yet. Login-time OTP still gates new
    // password sign-ins from unknown devices.
    await supabaseAdmin.from("trusted_devices").upsert(
      {
        user_id: userId,
        device_id: currentDevice,
        device_name: null,
        user_agent: currentUa,
        last_ip: currentIp,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" },
    );
    return { trusted: true, reason: "device-bootstrapped" as const };
  });

// List the user's trusted devices (for a future "Manage devices" screen).
export const listTrustedDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("trusted_devices")
      .select("id, device_id, device_name, user_agent, last_ip, last_seen_at, created_at")
      .eq("user_id", context.userId)
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { devices: data ?? [] };
  });
