// Admin-only server functions for managing individual employee accounts:
// fetching a full profile snapshot (logs/progress), promoting/demoting role,
// firing (terminate active package + revoke role), and sending custom emails.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailViaResend } from "@/server/email";
import { creditWalletInternal, debitWalletInternal } from "./wallet.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function emailShell(title: string, html: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:'Helvetica Neue',Arial,sans-serif;color:#0F1111">
  <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e7e7e7;border-radius:8px;overflow:hidden">
    <div style="background:#131A22;padding:18px 24px"><div style="color:#FF9900;font-weight:700;font-size:20px">AWZ<span style="color:#fff">.Jobs</span></div></div>
    <div style="padding:28px 24px"><h1 style="margin:0 0 12px;font-size:20px">${title}</h1>${html}</div>
    <div style="background:#f7f8fa;padding:14px 24px;border-top:1px solid #e7e7e7;font-size:12px;color:#565959;text-align:center">© AMZ.Jobs</div>
  </div></body></html>`;
}

// ============================================================
// FULL EMPLOYEE PROFILE (logs + progress)
// ============================================================
export const getEmployeeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const uid = data.user_id;

    const [
      profile, roles, kyc, packages, disbursements,
      tasks, attendance, earnings, withdrawals, loginIps, tickets,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role, created_at").eq("user_id", uid),
      supabaseAdmin.from("kyc_submissions").select("*").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("employment_packages").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabaseAdmin.from("salary_disbursements").select("*").eq("user_id", uid).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(24),
      supabaseAdmin.from("tasks").select("id, title, status, priority, reward_amount, created_at, deadline").eq("user_id", uid).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("attendance").select("work_date, check_in_at, check_out_at, hours_worked").eq("user_id", uid).order("work_date", { ascending: false }).limit(60),
      supabaseAdmin.from("earnings").select("amount, source, description, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("withdrawals").select("id, amount, status, created_at, processed_at, payout_method").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("login_ips").select("ip_address, user_agent, last_seen_at, created_at").eq("user_id", uid).order("last_seen_at", { ascending: false }).limit(30),
      supabaseAdmin.from("tickets").select("id, subject, status, category, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(20),
    ]);

    const taskRows = tasks.data || [];
    const totalEarned = (earnings.data || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const totalPaidOut = (withdrawals.data || [])
      .filter((w: any) => ["pending", "approved", "paid"].includes(w.status))
      .reduce((s: number, w: any) => s + Number(w.amount || 0), 0);

    return {
      profile: profile.data,
      roles: (roles.data || []).map((r: any) => r.role),
      kyc: kyc.data,
      packages: packages.data || [],
      activePackage: (packages.data || []).find((p: any) => p.is_active) || null,
      disbursements: disbursements.data || [],
      attendance: attendance.data || [],
      earnings: earnings.data || [],
      withdrawals: withdrawals.data || [],
      loginIps: loginIps.data || [],
      tickets: tickets.data || [],
      tasks: taskRows,
      stats: {
        totalEarned,
        balance: totalEarned - totalPaidOut,
        tasksTotal: taskRows.length,
        tasksDone: taskRows.filter((t: any) => t.status === "approved" || t.status === "submitted").length,
        tasksOpen: taskRows.filter((t: any) => ["assigned", "in_progress"].includes(t.status)).length,
      },
    };
  });

// ============================================================
// PROMOTE / DEMOTE (toggles admin role)
// ============================================================
export const setEmployeeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ user_id: z.string().uuid(), make_admin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId && !data.make_admin) {
      throw new Error("You cannot remove your own admin role.");
    }
    if (data.make_admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: "admin" });
      // ignore unique violation if already admin
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============================================================
// FIRE (terminate active packages + send notice)
// ============================================================
export const fireEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      reason: z.string().min(3).max(2000),
      effective_date: z.string().min(1).max(20),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("You can't fire yourself.");

    const { error } = await supabaseAdmin
      .from("employment_packages")
      .update({ is_active: false, ends_on: data.effective_date, notes: data.reason })
      .eq("user_id", data.user_id)
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("email, full_name").eq("id", data.user_id).maybeSingle();
      if (profile?.email) {
        await sendEmailViaResend({
          to: profile.email,
          toName: profile.full_name || undefined,
          subject: "Employment terminated",
          html: emailShell(
            "Your employment has ended",
            `<p>Hi ${profile.full_name || "there"},</p>
             <p>Your engagement has been terminated effective <strong>${data.effective_date}</strong>.</p>
             <p><strong>Reason:</strong> ${data.reason.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>
             <p>Any salary accrued up to this date will still be processed in the next disbursement cycle.</p>`,
          ),
        });
      }
    } catch (e) {
      console.error("fireEmployee email failed:", e);
    }
    return { ok: true };
  });

// ============================================================
// SEND CUSTOM EMAIL
// ============================================================
export const sendEmployeeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      subject: z.string().min(2).max(200),
      message: z.string().min(2).max(8000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles").select("email, full_name").eq("id", data.user_id).maybeSingle();
    if (!profile?.email) throw new Error("Employee has no email on file.");
    const safe = data.message.replace(/</g, "&lt;").replace(/\n/g, "<br/>");
    await sendEmailViaResend({
      to: profile.email,
      toName: profile.full_name || undefined,
      subject: data.subject,
      html: emailShell(data.subject, `<p>Hi ${profile.full_name || "there"},</p><p>${safe}</p>`),
    });
    return { ok: true };
  });

// ============================================================
// WALLET MANAGEMENT (admin credit/debit)
// ============================================================
export const adminUpdateWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      wallet: z.enum(["salary", "incentive"]),
      action: z.enum(["credit", "debit"]),
      amount: z.number().positive().max(1_000_000),
      reason: z.string().min(2).max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const adminId = context.userId;
    
    if (data.action === "credit") {
      await creditWalletInternal({
        user_id: data.user_id,
        wallet: data.wallet,
        amount: data.amount,
        reference: `admin-credit-${adminId.slice(0, 8)}`,
        description: `Admin credit: ${data.reason}`,
      });
    } else {
      await debitWalletInternal({
        user_id: data.user_id,
        wallet: data.wallet,
        amount: data.amount,
        type: "debit",
        reference: `admin-debit-${adminId.slice(0, 8)}`,
        description: `Admin debit: ${data.reason}`,
      });
    }
    return { ok: true, newBalance: null };
  });
