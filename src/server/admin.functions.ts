// Admin-only server functions for sensitive write operations that were
// previously performed via direct browser Supabase calls. Every handler
// validates the caller's admin role server-side before mutating data.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { debitWalletInternal } from "./wallet.server";

// ---------- helpers ----------

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

// ============================================================
// CV DOWNLOAD — admin gets signed URL (bypasses RLS)
// ============================================================

export const adminGetCvDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ cv_path: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: signedData, error } = await supabaseAdmin.storage
      .from("cv-uploads")
      .createSignedUrl(data.cv_path, 60 * 10); // 10 minutes
    if (error || !signedData?.signedUrl) throw new Error(error?.message || "Could not generate download link");
    return { signedUrl: signedData.signedUrl };
  });

// ============================================================
// USER ROLES (grant / revoke admin)
// ============================================================

export const adminGrantAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: "admin" } as never);
    // 23505 = unique violation; treat as already-admin (idempotent).
    if (error && (error as { code?: string }).code !== "23505") {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminRevokeAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("You cannot revoke your own admin role.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// KYC review
// ============================================================

export const adminDecideKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      submission_id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      admin_notes: z.string().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    
    // Get KYC submission details for email
    const { data: kycSubmission } = await supabaseAdmin
      .from("kyc_submissions")
      .select("*, user_id")
      .eq("id", data.submission_id)
      .maybeSingle();
    
    if (!kycSubmission) throw new Error("KYC submission not found");
    
    const { error } = await supabaseAdmin
      .from("kyc_submissions")
      .update({
        status: data.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        admin_notes: data.admin_notes ?? null,
      } as never)
      .eq("id", data.submission_id);
    if (error) throw new Error(error.message);
    
    // Send email notification
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", kycSubmission.user_id)
        .maybeSingle();
      
      if (profile?.email) {
        const { sendTemplatedEmail } = await import("./email-templates");
        await sendTemplatedEmail({
          to: profile.email,
          toName: profile.full_name || undefined,
          templateKey: data.status === "approved" ? "kyc_approved" : "kyc_rejected",
          variables: {
            full_name: profile.full_name || "there",
            rejection_reason: data.admin_notes || "Please contact support for more details.",
            dashboard_url: "https://amzsolution.amzsolution.workers.dev/dashboard",
            kyc_url: "https://amzsolution.amzsolution.workers.dev/dashboard/kyc"
          },
        });
      }
    } catch (emailError) {
      console.error("Failed to send KYC decision email:", emailError);
    }
    
    return { ok: true };
  });

// Reset an employee's KYC so they can re-submit (admin "Re-KYC" action).
export const adminResetKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      reason: z.string().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("kyc_submissions")
      .update({
        status: "not_started",
        admin_notes: data.reason ?? "Reset by admin — please re-submit your KYC.",
        reviewed_at: null,
        reviewed_by: null,
        document_front_url: null,
        document_back_url: null,
        selfie_url: null,
        payment_utr: null,
        payment_inr_amount: null,
        payment_screenshot_url: null,
        payment_submitted_at: null,
        fee_paid_at: null,
        fee_payment_reference: null,
      } as never)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin delete a ticket entirely (and its messages via FK cascade if set; otherwise messages first).
export const adminDeleteTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ticket_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("ticket_messages").delete().eq("ticket_id", data.ticket_id);
    const { error } = await supabaseAdmin.from("tickets").delete().eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// JOBS — create / update / delete / toggle
// ============================================================

const JobInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(20000),
  requirements: z.string().max(20000).optional().nullable(),
  responsibilities: z.string().max(20000).optional().nullable(),
  location: z.string().max(200).default("Remote / Work From Home"),
  employment_type: z.string().max(100).default("Full-time"),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  salary_currency: z.string().max(8).default("INR"),
  category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().default(true),
});

export const adminCreateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => JobInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("jobs")
      .insert({ ...data, created_by: context.userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const adminUpdateJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).merge(JobInput.partial()).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("jobs").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleJobActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("jobs")
      .update({ is_active: data.is_active } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// TICKETS — admin reply + status change
// ============================================================

export const adminReplyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      ticket_id: z.string().uuid(),
      message: z.string().min(1).max(10000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error: msgErr } = await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: data.ticket_id,
      sender_id: context.userId,
      message: data.message,
      is_admin_reply: true,
    } as never);
    if (msgErr) throw new Error(msgErr.message);
    const { error: tickErr } = await supabaseAdmin
      .from("tickets")
      .update({ status: "in_progress", updated_at: new Date().toISOString() } as never)
      .eq("id", data.ticket_id);
    if (tickErr) throw new Error(tickErr.message);
    return { ok: true };
  });

export const adminSetTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      ticket_id: z.string().uuid(),
      status: z.enum(["open", "in_progress", "resolved", "closed"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("tickets")
      .update({ status: data.status, updated_at: new Date().toISOString() } as never)
      .eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// TASKS — admin create + review (approve/reject with earnings credit)
// ============================================================

export const adminCreateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      title: z.string().min(1).max(300),
      description: z.string().min(1).max(20000),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      deadline: z.string().nullable().optional(),
      reward_amount: z.number().min(0).default(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        user_id: data.user_id,
        assigned_by: context.userId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        deadline: data.deadline || null,
        reward_amount: data.reward_amount,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

// Review a submitted task. On approval, credit the reward to earnings (idempotent
// per task — earnings are not double-credited if approve is called twice).
export const adminReviewTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      task_id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      review_notes: z.string().max(5000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: task, error: tErr } = await supabaseAdmin
      .from("tasks")
      .select("id, user_id, title, reward_amount, status")
      .eq("id", data.task_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!task) throw new Error("Task not found");

    const { error: upErr } = await supabaseAdmin
      .from("tasks")
      .update({
        status: data.status,
        review_notes: data.review_notes ?? null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      } as never)
      .eq("id", data.task_id);
    if (upErr) throw new Error(upErr.message);

    let credited = 0;
    if (data.status === "approved" && Number(task.reward_amount) > 0) {
      // Idempotency check: skip if an earnings row already exists for this task.
      const { data: existing } = await supabaseAdmin
        .from("earnings")
        .select("id")
        .eq("task_id", data.task_id)
        .maybeSingle();
      if (!existing) {
        const { error: eErr } = await supabaseAdmin.from("earnings").insert({
          user_id: task.user_id,
          amount: task.reward_amount,
          source: "task",
          task_id: task.id,
          description: `Task: ${task.title}`,
        } as never);
        if (eErr) throw new Error(eErr.message);
        credited = Number(task.reward_amount);
      }
    }
    return { ok: true, credited };
  });

// ============================================================
// SALARY SLIPS — admin delete
// ============================================================

export const adminDeleteSalarySlip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("salary_disbursements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// WITHDRAWALS — admin process (approve / pay / reject)
// On 'paid' we debit the user's wallet atomically.
// ============================================================

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approved", "paid", "rejected"]),
      admin_notes: z.string().max(2000).optional().nullable(),
      wallet: z.enum(["salary", "incentive"]).default("salary"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: w, error: wErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id, user_id, amount, status")
      .eq("id", data.id)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!w) throw new Error("Withdrawal not found");
    if ((w as any).status === "paid") throw new Error("Already paid");
    if ((w as any).status === "rejected") throw new Error("Already rejected");

    if (data.action === "paid") {
      // Debit wallet — throws if insufficient. Idempotent reference per withdrawal.
      await debitWalletInternal({
        user_id: (w as any).user_id,
        wallet: data.wallet,
        amount: Number((w as any).amount),
        type: "withdrawal",
        reference: `withdrawal:${data.id}`,
        description: `Withdrawal ${data.id} marked paid by admin`,
      });
    }

    const { error: upErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: data.action,
        rejection_reason: data.action === "rejected" ? data.admin_notes : null,
        processed_at: new Date().toISOString(),
        processed_by: context.userId,
      } as never)
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

// ============================================================
// PAYMENT QR — admin upload image (bypasses RLS)
// ============================================================

export const adminUploadPaymentQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ fileName: z.string(), contentType: z.string(), fileData: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const ext = data.fileName.split(".").pop() || "png";
    const path = `qr-${Date.now()}.${ext}`;
    const buffer = Buffer.from(data.fileData, "base64");
    const { error } = await supabaseAdmin.storage.from("payment-qr").upload(path, buffer, {
      upsert: true,
      contentType: data.contentType,
    });
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("payment-qr").getPublicUrl(path);
    return { path, url: pub.publicUrl };
  });

// ============================================================
// PAYMENT QR — admin remove image
// ============================================================

export const adminRemovePaymentQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    // Read existing setting to learn the storage path
    const { data: row } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "upi_qr")
      .maybeSingle();
    const v = (row as any)?.value || {};
    const path: string | null = v.storage_path || null;

    if (path) {
      await supabaseAdmin.storage.from("payment-assets").remove([path]).catch(() => null);
    }

    const { error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({
        key: "upi_qr",
        value: { ...v, qr_url: null, storage_path: null },
        is_public: true,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      } as never, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
