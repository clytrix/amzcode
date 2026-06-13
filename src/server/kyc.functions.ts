import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTemplatedEmail } from "@/server/email-templates";

/**
 * KYC flow (manual UPI payment):
 *   not_started → (saveKycDetails)        → not_started (with details filled)
 *                 (upload docs to storage) → not_started
 *                 (submitKycPaymentUtr)    → documents_submitted
 *                 (admin approves)         → approved
 *                 (admin rejects)          → rejected (user can retry)
 */

const KycDetailsSchema = z.object({
  full_name: z.string().min(1).max(200),
  date_of_birth: z.string().min(1).max(20),
  address: z.string().min(5).max(500),
  document_type: z.string().min(1).max(50).default("Aadhaar Card"),
  document_number: z.string().min(1).max(100),
  pan_number: z.string().max(20).optional().nullable(),
  aadhaar_number: z.string().max(20).optional().nullable(),
  bank_account_holder: z.string().min(1).max(200),
  bank_account_number: z.string().min(1).max(64),
  bank_name: z.string().min(1).max(200).default("—"),
  bank_ifsc_swift: z.string().min(1).max(32),
  upi_id: z.string().max(100).optional().nullable(),
});

/** Step 1: Save personal + bank details. Status remains not_started/rejected. */
export const saveKycDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => KycDetailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    const { data: existing } = await supabaseAdmin
      .from("kyc_submissions").select("id, status").eq("user_id", userId).maybeSingle();
    if (existing && (existing.status === "approved" || existing.status === "documents_submitted" || existing.status === "payment_submitted" || existing.status === "fee_paid")) {
      throw new Error("Your KYC is already submitted and cannot be edited.");
    }
    const payload = {
      full_name: data.full_name,
      date_of_birth: data.date_of_birth,
      address: data.address,
      document_type: data.document_type,
      document_number: data.document_number,
      pan_number: data.pan_number || null,
      aadhaar_number: data.aadhaar_number || null,
      bank_account_holder: data.bank_account_holder,
      bank_account_number: data.bank_account_number,
      bank_name: data.bank_name,
      bank_ifsc_swift: data.bank_ifsc_swift,
      upi_id: data.upi_id || null,
    };
    if (existing) {
      const { error } = await supabaseAdmin.from("kyc_submissions").update(payload).eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("kyc_submissions").insert({ user_id: userId, status: "not_started", ...payload } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

const UtrSchema = z.object({
  utr: z.string().min(6).max(64).regex(/^[A-Za-z0-9-]+$/, "UTR must be alphanumeric"),
  inr_amount: z.number().positive().max(1_000_000),
  screenshot_url: z.string().max(500).optional().nullable(),
});

/** Step 4: Submit UPI UTR after manual payment. Moves status to documents_submitted. */
export const submitKycPaymentUtr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UtrSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    const { data: existing } = await supabaseAdmin
      .from("kyc_submissions").select("*").eq("user_id", userId).maybeSingle();
    if (!existing) throw new Error("Please complete the KYC details form first.");
    if (existing.status === "approved") throw new Error("Your KYC is already approved.");
    if (existing.status === "documents_submitted" || existing.status === "payment_submitted") {
      throw new Error("Payment already submitted. Please wait for review.");
    }
    if (!existing.full_name || !existing.bank_account_number) {
      throw new Error("Please complete the personal & bank details form first.");
    }
    if (!existing.document_front_url || !existing.selfie_url) {
      throw new Error("Please upload your ID document and selfie before paying.");
    }

    const submittedAt = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin.from("kyc_submissions").update({
      payment_utr: data.utr.toUpperCase(),
      payment_inr_amount: data.inr_amount,
      payment_submitted_at: submittedAt,
      payment_screenshot_url: data.screenshot_url || null,
      fee_payment_reference: data.utr.toUpperCase(),
      fee_paid_at: submittedAt,
      status: "documents_submitted" as const,
    } as any).eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    // Auto-create admin support ticket
    try {
      const { data: ticket } = await supabaseAdmin.from("tickets").insert({
        user_id: userId,
        subject: `KYC payment submitted — UTR ${data.utr.toUpperCase()}`,
        category: "kyc" as any,
        status: "open" as any,
      }).select("id").single();
      if (ticket?.id) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: userId,
          is_admin_reply: false,
          message: `KYC verification fee paid via UPI.\n\nUTR / Transaction ref: ${data.utr.toUpperCase()}\nAmount: ₹${data.inr_amount}\nName: ${existing.full_name}\nBank A/C: ${existing.bank_account_number}\n\nPlease verify the UTR and approve.`,
        });
      }
    } catch (e) { console.error("KYC ticket creation failed", e); }

    // Email notification (best-effort)
    try {
      const { data: profile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
      if (profile?.email) {
        await sendTemplatedEmail({
          to: profile.email, toName: profile.full_name || undefined,
          templateKey: "kyc_documents_submitted",
          variables: { 
            full_name: profile.full_name || "there", 
            payment_reference: data.utr.toUpperCase(), 
            fee_amount: data.inr_amount,
            kyc_url: "https://amzsolution.amzsolution.workers.dev/dashboard/kyc"
          },
        });
      }
    } catch (e) { console.error("KYC email failed", e); }

    return { ok: true, utr: data.utr.toUpperCase(), submitted_at: submittedAt };
  });

/** BACKWARD-COMPAT: previous mock-payment flow. Kept so older imports compile but
 *  immediately routes to the new manual flow by saving details only.
 *  Old callers should switch to saveKycDetails + submitKycPaymentUtr. */
export const processKycPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => KycDetailsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    // Save details only — DO NOT auto-mark paid. User must submit UTR manually.
    const payload = {
      full_name: data.full_name, date_of_birth: data.date_of_birth, address: data.address,
      document_type: data.document_type, document_number: data.document_number,
      pan_number: data.pan_number || null, aadhaar_number: data.aadhaar_number || null,
      bank_account_holder: data.bank_account_holder, bank_account_number: data.bank_account_number,
      bank_name: data.bank_name, bank_ifsc_swift: data.bank_ifsc_swift, upi_id: data.upi_id || null,
    };
    const { data: existing } = await supabaseAdmin.from("kyc_submissions").select("id").eq("user_id", userId).maybeSingle();
    if (existing) await supabaseAdmin.from("kyc_submissions").update(payload).eq("user_id", userId);
    else await supabaseAdmin.from("kyc_submissions").insert({ user_id: userId, status: "not_started", ...payload } as any);
    return { ok: true, reference: "PENDING-UTR", paidAt: null, fee_usd: 79 };
  });

/** Update KYC document URLs after upload */
export const updateKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { field: "document_front_url" | "document_back_url" | "selfie_url" | "payment_screenshot_url"; path: string | null }) => input)
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    const { data: existing } = await supabaseAdmin
      .from("kyc_submissions").select("id, status").eq("user_id", userId).maybeSingle();
    
    // Allow updates if not approved or in final stages
    if (existing && (existing.status === "approved")) {
      throw new Error("Cannot modify documents after KYC is approved.");
    }
    
    const patch: any = { [data.field]: data.path };
    if (existing) {
      const { error } = await supabaseAdmin.from("kyc_submissions" as any).update(patch).eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      // Create new KYC record with just the document
      const { error } = await supabaseAdmin.from("kyc_submissions").insert({ 
        user_id: userId, 
        status: "not_started",
        ...patch 
      } as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
