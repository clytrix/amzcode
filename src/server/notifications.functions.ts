import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmailViaResend } from "@/server/email";
import {
  sendTemplatedEmail,
  buildTaskUrl,
  buildDashboardUrl,
  buildKycUrl,
  type TemplateKey,
} from "@/server/email-templates";

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

/**
 * Notify a user that they've been assigned a new task. Admin-only.
 * Uses the editable `task_assigned` template.
 */
export const notifyTaskAssigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ task_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .select("id, title, description, deadline, reward_amount, user_id")
      .eq("id", data.task_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("Task not found");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", task.user_id)
      .maybeSingle();
    if (!profile?.email) return { ok: false, reason: "no-email" };

    await sendTemplatedEmail({
      to: profile.email,
      toName: profile.full_name || undefined,
      templateKey: "task_assigned",
      variables: {
        employee_name: profile.full_name || "there",
        task_title: task.title,
        task_description: (task.description || "").slice(0, 600),
        reward_amount: Number(task.reward_amount || 0),
        deadline: task.deadline ? new Date(task.deadline).toLocaleString("en-IN") : "No deadline",
        task_url: buildTaskUrl(),
      },
    });
    return { ok: true };
  });

/**
 * Notify the applicant of their job application decision. Admin-only.
 * (Uses inline HTML — kept as-is from previous implementation.)
 */
export const notifyApplicationDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        application_id: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        admin_notes: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: app } = await supabaseAdmin
      .from("job_applications")
      .select("user_id, job_id")
      .eq("id", data.application_id)
      .maybeSingle();
    if (!app) throw new Error("Application not found");
    const [profileRes, jobRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("email, full_name").eq("id", app.user_id).maybeSingle(),
      supabaseAdmin.from("jobs").select("title").eq("id", app.job_id).maybeSingle(),
    ]);
    const email = profileRes.data?.email;
    if (!email) return { ok: false, reason: "no-email" };
    const jobTitle = jobRes.data?.title || "the role";
    const isApproved = data.status === "approved";
    const subject = isApproved
      ? `Congratulations — you've been approved for ${jobTitle}`
      : `Update on your application for ${jobTitle}`;
    const noteBlock = data.admin_notes
      ? `<div style="background:#f7f8fa;border-left:3px solid #FF9900;padding:10px 14px;margin:14px 0;font-size:13px"><b>Note from the team:</b><br/>${escapeHtml(data.admin_notes)}</div>`
      : "";
    const body = isApproved
      ? `<p>Hi ${escapeHtml(profileRes.data?.full_name || "there")},</p>
         <p>Great news — your application for <b>${escapeHtml(jobTitle)}</b> has been <b style="color:#067d62">approved</b>!</p>
         <p>You can now access your full employee dashboard, browse tasks, track attendance, and request withdrawals once KYC is complete.</p>
         ${noteBlock}`
      : `<p>Hi ${escapeHtml(profileRes.data?.full_name || "there")},</p>
         <p>Thank you for applying for <b>${escapeHtml(jobTitle)}</b>. After review, we won't be moving forward with your application at this time.</p>
         ${noteBlock}
         <p>You're welcome to apply for other open roles on the portal.</p>`;
    const html = `<!doctype html><html><body style="margin:0;background:#f3f3f3;font-family:Arial,sans-serif;color:#0F1111">
<div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e7e7e7;border-radius:8px"><div style="padding:24px">${body}</div></div></body></html>`;
    await sendEmailViaResend({ to: email, toName: profileRes.data?.full_name || undefined, subject, html });
    return { ok: true };
  });

/**
 * Notify a user when their KYC submission moves to a new status. Admin-callable
 * (or callable by the user themselves only for `documents_submitted`/`fee_paid`
 * which they can trigger by completing payment).
 */
const KYC_TEMPLATE_MAP: Record<string, TemplateKey> = {
  documents_submitted: "kyc_documents_submitted",
  fee_paid: "kyc_fee_paid",
  in_review: "kyc_in_review",
  approved: "kyc_approved",
  rejected: "kyc_rejected",
};

export const notifyKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        user_id: z.string().uuid(),
        status: z.enum(["documents_submitted", "fee_paid", "in_review", "approved", "rejected"]),
        admin_notes: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Allow users to trigger their own self-service notifications (post-payment),
    // but require admin for review-stage transitions.
    const selfServiceStatuses = new Set(["documents_submitted", "fee_paid"]);
    if (data.user_id !== context.userId || !selfServiceStatuses.has(data.status)) {
      await assertAdmin(context.userId);
    }

    const [profileRes, kycRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("email, full_name").eq("id", data.user_id).maybeSingle(),
      supabaseAdmin
        .from("kyc_submissions")
        .select("fee_amount, fee_payment_reference")
        .eq("user_id", data.user_id)
        .maybeSingle(),
    ]);

    const email = profileRes.data?.email;
    if (!email) return { ok: false, reason: "no-email" };

    const templateKey = KYC_TEMPLATE_MAP[data.status];
    await sendTemplatedEmail({
      to: email,
      toName: profileRes.data?.full_name || undefined,
      templateKey,
      variables: {
        employee_name: profileRes.data?.full_name || "there",
        fee_amount: Number(kycRes.data?.fee_amount || 0),
        payment_reference: kycRes.data?.fee_payment_reference || "—",
        admin_notes: data.admin_notes || "Please review the requirements and resubmit.",
        dashboard_url: buildDashboardUrl(),
        kyc_url: buildKycUrl(),
      },
    });
    return { ok: true };
  });

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
