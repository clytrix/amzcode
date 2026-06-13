// Admin audit log queries: credential access + login IP history.
// All admin-only — auth-middleware ensures the requesting user is signed in,
// and we explicitly verify the admin role server-side before returning data.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin role required");
}

const filterSchema = z.object({
  userId: z.string().uuid().optional().nullable(),
  ipAddress: z.string().trim().max(64).optional().nullable(),
  fromIso: z.string().datetime().optional().nullable(),
  toIso: z.string().datetime().optional().nullable(),
  limit: z.number().int().min(1).max(500).optional().default(200),
});

export type AuditFilters = z.infer<typeof filterSchema>;

export interface CredentialAuditRow {
  id: string;
  viewed_at: string;
  viewer_id: string;
  viewer_email: string | null;
  viewer_name: string | null;
  credential_id: string;
  credential_label: string | null;
  task_id: string | null;
  task_title: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface LoginIpRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  ip_address: string;
  user_agent: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface OtpEventRow {
  id: string;
  email: string;
  purpose: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  consumed_at: string | null;
  expires_at: string;
  attempts: number;
}

export interface AuditPayload {
  credentialAccess: CredentialAuditRow[];
  loginIps: LoginIpRow[];
  otpEvents: OtpEventRow[];
}

export const getAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(filterSchema.parse)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const limit = data.limit ?? 200;
    const userFilter = data.userId || null;
    const ipFilter = data.ipAddress?.trim() || null;
    const fromIso = data.fromIso || null;
    const toIso = data.toIso || null;

    // ---- Credential access log ----
    let credQ = supabaseAdmin
      .from("credential_access_log")
      .select("id, created_at, user_id, credential_id, ip_address, user_agent")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (userFilter) credQ = credQ.eq("user_id", userFilter);
    if (ipFilter) credQ = credQ.ilike("ip_address", `%${ipFilter}%`);
    if (fromIso) credQ = credQ.gte("created_at", fromIso);
    if (toIso) credQ = credQ.lte("created_at", toIso);
    const { data: credRows, error: credErr } = await credQ;
    if (credErr) throw new Error(credErr.message);

    // Hydrate viewer + credential metadata
    const credIds = Array.from(new Set((credRows ?? []).map((r) => r.credential_id)));
    const viewerIds = Array.from(new Set((credRows ?? []).map((r) => r.user_id)));

    const [credMetaRes, viewerMetaRes] = await Promise.all([
      credIds.length
        ? supabaseAdmin
            .from("task_credentials")
            .select("id, label, task_id, tasks:task_id(title)")
            .in("id", credIds)
        : Promise.resolve({ data: [], error: null }),
      viewerIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id, email, full_name")
            .in("id", viewerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const credMeta = new Map<string, { label: string | null; task_id: string | null; task_title: string | null }>();
    for (const c of (credMetaRes.data as any[]) || []) {
      credMeta.set(c.id, { label: c.label, task_id: c.task_id, task_title: c.tasks?.title ?? null });
    }
    const viewerMeta = new Map<string, { email: string | null; full_name: string | null }>();
    for (const p of (viewerMetaRes.data as any[]) || []) {
      viewerMeta.set(p.id, { email: p.email, full_name: p.full_name });
    }

    const credentialAccess: CredentialAuditRow[] = (credRows ?? []).map((r) => ({
      id: r.id,
      viewed_at: r.created_at,
      viewer_id: r.user_id,
      viewer_email: viewerMeta.get(r.user_id)?.email ?? null,
      viewer_name: viewerMeta.get(r.user_id)?.full_name ?? null,
      credential_id: r.credential_id,
      credential_label: credMeta.get(r.credential_id)?.label ?? null,
      task_id: credMeta.get(r.credential_id)?.task_id ?? null,
      task_title: credMeta.get(r.credential_id)?.task_title ?? null,
      ip_address: r.ip_address ?? null,
      user_agent: r.user_agent ?? null,
    }));

    // ---- Login IPs ----
    let ipQ = supabaseAdmin
      .from("login_ips")
      .select("id, user_id, ip_address, user_agent, last_seen_at, created_at")
      .order("last_seen_at", { ascending: false })
      .limit(limit);
    if (userFilter) ipQ = ipQ.eq("user_id", userFilter);
    if (ipFilter) ipQ = ipQ.ilike("ip_address", `%${ipFilter}%`);
    if (fromIso) ipQ = ipQ.gte("last_seen_at", fromIso);
    if (toIso) ipQ = ipQ.lte("last_seen_at", toIso);
    const { data: ipRows, error: ipErr } = await ipQ;
    if (ipErr) throw new Error(ipErr.message);

    const ipUserIds = Array.from(new Set((ipRows ?? []).map((r) => r.user_id)));
    const ipUserMetaRes = ipUserIds.length
      ? await supabaseAdmin.from("profiles").select("id, email, full_name").in("id", ipUserIds)
      : { data: [] as any[], error: null };
    const ipUserMeta = new Map<string, { email: string | null; full_name: string | null }>();
    for (const p of (ipUserMetaRes.data as any[]) || []) {
      ipUserMeta.set(p.id, { email: p.email, full_name: p.full_name });
    }
    const loginIps: LoginIpRow[] = (ipRows ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_email: ipUserMeta.get(r.user_id)?.email ?? null,
      user_name: ipUserMeta.get(r.user_id)?.full_name ?? null,
      ip_address: r.ip_address,
      user_agent: r.user_agent ?? null,
      last_seen_at: r.last_seen_at,
      created_at: r.created_at,
    }));

    // ---- OTP events (anonymized: hashes only) ----
    let otpQ = supabaseAdmin
      .from("otp_codes")
      .select("id, email, purpose, ip_address, user_agent, created_at, consumed_at, expires_at, attempts")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (ipFilter) otpQ = otpQ.ilike("ip_address", `%${ipFilter}%`);
    if (fromIso) otpQ = otpQ.gte("created_at", fromIso);
    if (toIso) otpQ = otpQ.lte("created_at", toIso);
    const { data: otpRows, error: otpErr } = await otpQ;
    if (otpErr) throw new Error(otpErr.message);

    return {
      credentialAccess,
      loginIps,
      otpEvents: (otpRows ?? []) as OtpEventRow[],
    } satisfies AuditPayload;
  });

// Quick helper to get the list of admin-visible users for the filter dropdown.
export const listUsersForAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .order("email", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data || []) as { id: string; email: string; full_name: string | null }[];
  });
