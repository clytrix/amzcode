import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creditWalletInternal } from "./wallet.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

/** User-callable: get my wallet + recent transactions */
export const getMyWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId;
    await supabaseAdmin.from("wallets").upsert({ user_id: userId }, { onConflict: "user_id" });
    const [w, tx] = await Promise.all([
      supabaseAdmin.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      wallet: w.data || { user_id: userId, salary_balance: 0, incentive_balance: 0 },
      transactions: tx.data || [],
    };
  });

/** User: request withdrawal with 18% service fee */
export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    amount: number;
    payout_method: string;
    payout_details: string;
    service_fee_utr: string;
    service_fee_screenshot_url?: string | null;
  }) => {
    if (!input.amount || input.amount < 5000) throw new Error("Minimum withdrawal is ₹5,000");
    if (input.amount > 500000) throw new Error("Maximum withdrawal is ₹500,000");
    if (!input.payout_method) throw new Error("Payout method required");
    if (!input.payout_details) throw new Error("Payout details required");
    if (!input.service_fee_utr || input.service_fee_utr.length < 6) throw new Error("Valid service fee UTR required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    const serviceFee = Math.round(data.amount * 0.18);

    // Check KYC status if required
    const { data: kycSubmission } = await supabaseAdmin
      .from("kyc_submissions")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    
    const kycStatus = kycSubmission?.status || "not_started";
    console.log("Withdrawal request - KYC status:", kycStatus, "for user:", userId);
    
    if (kycStatus !== "approved") {
      throw new Error("KYC verification is required for withdrawals. Your current status: " + kycStatus.replace(/_/g, " "));
    }

    // Verify wallet balance
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("salary_balance, incentive_balance")
      .eq("user_id", userId)
      .maybeSingle();
    const totalBalance = Number(wallet?.salary_balance || 0) + Number(wallet?.incentive_balance || 0);
    if (totalBalance < data.amount) throw new Error("Insufficient balance");

    // Check for existing pending withdrawal
    const { data: existing } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["pending_payment", "pending"])
      .maybeSingle();
    if (existing) throw new Error("You already have a pending withdrawal request");

    // Create withdrawal request
    const { error } = await supabaseAdmin.from("withdrawal_requests").insert({
      user_id: userId,
      amount: data.amount,
      service_fee_amount: serviceFee,
      service_fee_paid: true,
      service_fee_payment_utr: data.service_fee_utr.toUpperCase(),
      service_fee_paid_at: new Date().toISOString(),
      status: "pending",
      bank_account_id: null,
      payout_method: data.payout_method,
      payout_details: data.payout_details,
      service_fee_screenshot_url: data.service_fee_screenshot_url || null,
    } as any);

    if (error) throw new Error(error.message);

    // Create ticket for admin
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      const { data: ticket } = await supabaseAdmin.from("tickets").insert({
        user_id: userId,
        subject: `Withdrawal Request - ${data.amount} INR`,
        category: "payment",
        status: "open",
      }).select("id").single();

      if (ticket?.id) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: userId,
          is_admin_reply: false,
          message: `Withdrawal Request Details:

Amount: ₹${data.amount}
Service Fee (18%): ₹${serviceFee}
Service Fee UTR: ${data.service_fee_utr.toUpperCase()}
Payout Method: ${data.payout_method}
Payout Details: ${data.payout_details}

User: ${profile?.full_name || 'Unknown'} (${profile?.email || 'No email'})

Please verify service fee payment and process the withdrawal.`,
        });
      }
    } catch (e) {
      console.error("Failed to create ticket:", e);
    }

    return { ok: true, service_fee: serviceFee, message: "Withdrawal request submitted. Admin will review shortly." };
  });

/** Get my withdrawal history */
export const getMyWithdrawals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId;
    const { data, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { withdrawals: data || [] };
  });

/** Admin-only: manually credit a user's wallet */
export const adminCreditWallet = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { user_id: string; wallet: "salary" | "incentive"; amount: number; description?: string }) => {
      if (!input.user_id) throw new Error("user_id required");
      if (input.wallet !== "salary" && input.wallet !== "incentive") throw new Error("invalid wallet");
      if (!input.amount || input.amount <= 0 || input.amount > 1_000_000) throw new Error("invalid amount");
      return input;
    },
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    await creditWalletInternal({
      user_id: data.user_id,
      wallet: data.wallet,
      amount: data.amount,
      description: data.description || `Admin credit by ${(context as any).userId}`,
    });
    return { ok: true };
  });
