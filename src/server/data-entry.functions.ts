import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creditWalletInternal } from "./wallet.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

/** Get today's pool with the matching invoice + the user's submission state. */
export const getMyDataEntryToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId;
    
    // Get user's active subscription to check daily task limit
    const { data: subscription } = await supabaseAdmin
      .from("user_data_entry_subscriptions" as any)
      .select("*, package:data_entry_packages(*)")
      .eq("user_id", userId)
      .eq("payment_status", "paid")
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false })
      .maybeSingle();
    
    const dailyLimit = (subscription as any)?.package?.daily_task_limit || 0;
    
    // Get today's pool with invoice data, limited by user's plan
    const today = new Date().toISOString().split("T")[0];
    const { data: pool } = await supabaseAdmin
      .from("data_entry_daily_pool" as any)
      .select("id, pool_date, position, reward_amount, invoice_id, data_entry_invoices(*)")
      .eq("pool_date", today)
      .order("position", { ascending: true })
      .limit(dailyLimit > 0 ? dailyLimit : 30); // Default to 30 if no subscription
    
    const poolList = (pool || []) as any[];
    const poolIds = poolList.map((p) => p.id);
    const { data: subs } = poolIds.length
      ? await supabaseAdmin.from("data_entry_submissions" as any).select("*, reward_credited_at").in("pool_id", poolIds).eq("user_id", userId)
      : { data: [] as any[] };
    const subMap = new Map((subs || []).map((s: any) => [s.pool_id, s]));
    
    return {
      pool: poolList.map((p: any) => ({
        ...p,
        invoice: p.data_entry_invoices,
        submission: subMap.get(p.id) || null,
      })),
      dailyLimit,
      hasSubscription: !!subscription,
    };
  });

const SubmissionSchema = z.object({
  pool_id: z.string().uuid(),
  vendor_name: z.string().max(200).optional().nullable(),
  invoice_number: z.string().max(100).optional().nullable(),
  invoice_date: z.string().optional().nullable(),
  amount: z.number().min(0).max(1e9).optional().nullable(),
  tax_amount: z.number().min(0).max(1e9).optional().nullable(),
  gst_number: z.string().max(50).optional().nullable(),
  mark_done: z.boolean().optional(),
});

export const upsertDataEntrySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubmissionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    // Get pool item with reward amount and linked invoice
    const { data: pool } = await supabaseAdmin
      .from("data_entry_daily_pool" as any)
      .select("pool_date, reward_amount, invoice_id, data_entry_invoices(*)")
      .eq("id", data.pool_id)
      .maybeSingle();
    if (!pool) throw new Error("Invalid task");

    const invoice = (pool as any).data_entry_invoices;
    const rewardAmount = Number((pool as any).reward_amount || 150);

    // Auto-verification: compare entered data with invoice data
    let verificationScore = 0;
    let maxScore = 0;
    const errors: string[] = [];

    // Check vendor name (case-insensitive, allow partial match)
    if (invoice?.vendor_name && data.vendor_name) {
      maxScore += 20;
      const entered = data.vendor_name.toLowerCase().trim();
      const actual = invoice.vendor_name.toLowerCase().trim();
      if (entered === actual || actual.includes(entered) || entered.includes(actual)) {
        verificationScore += 20;
      } else {
        errors.push(`Vendor name mismatch: expected "${invoice.vendor_name}"`);
      }
    }

    // Check invoice number (case-insensitive, allow partial)
    if (invoice?.invoice_number && data.invoice_number) {
      maxScore += 25;
      const entered = data.invoice_number.toLowerCase().replace(/\s/g, "");
      const actual = invoice.invoice_number.toLowerCase().replace(/\s/g, "");
      if (entered === actual || actual.includes(entered) || entered.includes(actual)) {
        verificationScore += 25;
      } else {
        errors.push(`Invoice number mismatch: expected "${invoice.invoice_number}"`);
      }
    }

    // Check amount (within 1% tolerance)
    if (invoice?.amount != null && data.amount != null) {
      maxScore += 25;
      const entered = Number(data.amount);
      const actual = Number(invoice.amount);
      const diff = Math.abs(entered - actual);
      const tolerance = actual * 0.01; // 1% tolerance
      if (diff <= tolerance) {
        verificationScore += 25;
      } else {
        errors.push(`Amount mismatch: expected ₹${actual}, got ₹${entered}`);
      }
    }

    // Check invoice date (exact match or close)
    if (invoice?.invoice_date && data.invoice_date) {
      maxScore += 15;
      const entered = data.invoice_date;
      const actual = invoice.invoice_date;
      if (entered === actual) {
        verificationScore += 15;
      } else {
        // Check if dates are close (within 1 day for formatting differences)
        const enteredDate = new Date(entered);
        const actualDate = new Date(actual);
        const diffDays = Math.abs(enteredDate.getTime() - actualDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 1) {
          verificationScore += 15;
        } else {
          errors.push(`Date mismatch: expected ${actual}`);
        }
      }
    }

    // Check GST number (if present, case-insensitive)
    if (invoice?.gst_number && data.gst_number) {
      maxScore += 15;
      const entered = data.gst_number.toLowerCase().replace(/\s/g, "");
      const actual = invoice.gst_number.toLowerCase().replace(/\s/g, "");
      if (entered === actual) {
        verificationScore += 15;
      } else {
        errors.push(`GST number mismatch`);
      }
    }

    // Require at least 75% accuracy to approve
    const accuracyRate = maxScore > 0 ? (verificationScore / maxScore) * 100 : 0;
    const isApproved = accuracyRate >= 75;

    if (data.mark_done && !isApproved) {
      throw new Error(
        `Data verification failed (${Math.round(accuracyRate)}% accuracy). ` +
        `Required: 75%. Issues: ${errors.join("; ") || "Fields don't match invoice"}`
      );
    }

    const payload: any = {
      user_id: userId,
      pool_id: data.pool_id,
      pool_date: (pool as any).pool_date,
      vendor_name: data.vendor_name ?? null,
      invoice_number: data.invoice_number ?? null,
      invoice_date: data.invoice_date || null,
      amount: data.amount ?? null,
      tax_amount: data.tax_amount ?? null,
      gst_number: data.gst_number ?? null,
    };

    if (data.mark_done) {
      payload.is_done = true;
      payload.done_at = new Date().toISOString();
      payload.verified_accuracy = Math.round(accuracyRate);
    }

    // Check for existing submission
    const { data: existing } = await supabaseAdmin
      .from("data_entry_submissions" as any)
      .select("id")
      .eq("user_id", userId)
      .eq("pool_id", data.pool_id)
      .maybeSingle();

    if (existing) {
      // Update existing submission
      const { error } = await supabaseAdmin
        .from("data_entry_submissions" as any)
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      // Insert new submission
      const { error } = await supabaseAdmin
        .from("data_entry_submissions" as any)
        .insert(payload);
      if (error) throw new Error(error.message);
    }

    // Credit reward if marked done and not already credited
    if (data.mark_done && isApproved) {
      // Check if already credited
      const { data: existingSub } = await supabaseAdmin
        .from("data_entry_submissions" as any)
        .select("reward_credited")
        .eq("user_id", userId)
        .eq("pool_id", data.pool_id)
        .maybeSingle();

      if (!(existingSub as any)?.reward_credited) {
        // Credit incentive wallet
        try {
          await creditWalletInternal({
            user_id: userId,
            wallet: "incentive",
            amount: rewardAmount,
            reference: `data-entry-${data.pool_id}`,
            description: `Data entry task #${data.pool_id.slice(0, 8)} completed (${Math.round(accuracyRate)}% accuracy)`,
          });

          // Mark as credited with timestamp
          await supabaseAdmin
            .from("data_entry_submissions" as any)
            .update({
              reward_credited: true,
              reward_credited_at: new Date().toISOString()
            })
            .eq("user_id", userId)
            .eq("pool_id", data.pool_id);
        } catch (creditError: any) {
          console.error("Failed to credit wallet:", creditError);
          // Don't throw - allow submission to succeed even if credit fails
          // The admin can manually credit later
        }
      }
    }

    return { ok: true, approved: isApproved, accuracy: Math.round(accuracyRate) };
  });

// ---------------- ADMIN ----------------

const InvoiceSchema = z.object({
  id: z.string().uuid().optional(),
  vendor_name: z.string().min(1).max(200),
  invoice_number: z.string().min(1).max(100),
  invoice_date: z.string().optional().nullable(),
  amount: z.number().min(0).max(1e9),
  tax_amount: z.number().min(0).max(1e9).default(0),
  gst_number: z.string().max(50).optional().nullable(),
  image_url: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const adminUpsertInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InvoiceSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const payload = { ...data, created_by: (context as any).userId } as any;
    const { error } = await supabaseAdmin
      .from("data_entry_invoices" as any)
      .upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const { error } = await supabaseAdmin.from("data_entry_invoices" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRolloverPoolNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    const { data, error } = await supabaseAdmin.rpc("rollover_data_entry_pool" as any);
    if (error) throw new Error(error.message);
    return { result: data };
  });

export const adminAccrueSalaryNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    const { data, error } = await supabaseAdmin.rpc("accrue_daily_salary" as any);
    if (error) throw new Error(error.message);
    return { result: data };
  });

export const adminUpdatePoolReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ pool_id: z.string().uuid(), reward_amount: z.number().min(1).max(10000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const { error } = await supabaseAdmin
      .from("data_entry_daily_pool" as any)
      .update({ reward_amount: data.reward_amount })
      .eq("id", data.pool_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateAllPoolRewards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reward_amount: z.number().min(1).max(10000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    // Use RPC to update all records (Supabase JS requires a WHERE clause)
    const { error } = await supabaseAdmin.rpc("update_all_pool_rewards" as any, {
      new_reward: data.reward_amount,
    });
    if (error) {
      // Fallback: update each record individually
      const { data: pool } = await supabaseAdmin.from("data_entry_daily_pool" as any).select("id");
      if (pool && pool.length > 0) {
        for (const p of pool) {
          await supabaseAdmin
            .from("data_entry_daily_pool" as any)
            .update({ reward_amount: data.reward_amount })
            .eq("id", (p as any).id);
        }
      }
    }
    return { ok: true, updated: "all" };
  });
