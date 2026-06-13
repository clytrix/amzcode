import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Helper to check admin role
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

// ==========================================
// USER FUNCTIONS
// ==========================================

/** Get available packages for purchase (no auth required — uses admin client) */
export const getAvailablePackages = createServerFn({ method: "POST" })
  .handler(async () => {
    const { data, error } = await (supabaseAdmin
      .from("data_entry_packages") as any)
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { packages: data || [] };
  });

/** Get user's current subscription status (active + pending) */
export const getMyDataEntrySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId;

    // Get active (paid, non-expired) subscription
    const { data: subscription } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("*, package:data_entry_packages(*)")
      .eq("user_id", userId)
      .eq("payment_status", "paid")
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false })
      .maybeSingle();

    // Get latest pending subscription (awaiting admin approval)
    const { data: pendingSubscription } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("*, package:data_entry_packages(*)")
      .eq("user_id", userId)
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .maybeSingle();

    // Get today's completion count
    const today = new Date().toISOString().split("T")[0];
    const { data: completion } = await (supabaseAdmin
      .from("data_entry_daily_completions") as any)
      .select("tasks_completed")
      .eq("user_id", userId)
      .eq("completion_date", today)
      .maybeSingle();

    return {
      subscription,
      pendingSubscription,
      todayCompleted: (completion as any)?.tasks_completed || 0,
      dailyLimit: (subscription as any)?.package?.daily_task_limit || 0,
    };
  });

/** Get UPI payment settings (server-side via admin client to bypass RLS edge cases) */
export const getPaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "payments.upi")
      .maybeSingle();
    return (data?.value as any) || null;
  });

/** Purchase a package (creates pending subscription) */
export const purchaseDataEntryPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { 
    package_id: string; 
    duration_days: number;
    payment_utr: string; 
    payment_screenshot_url?: string | null;
    referral_code?: string | null;
  }) => {
    if (!input.package_id) throw new Error("Package ID required");
    if (!input.payment_utr || input.payment_utr.length < 6) throw new Error("Valid UTR required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;
    
    // Get package details
    const { data: pkg } = await (supabaseAdmin
      .from("data_entry_packages") as any)
      .select("*")
      .eq("id", data.package_id)
      .eq("is_active", true)
      .maybeSingle();
    
    if (!pkg) throw new Error("Package not found or inactive");
    
    // Check if user already has pending subscription for this package
    const { data: existing } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("id, payment_status")
      .eq("user_id", userId)
      .eq("package_id", data.package_id)
      .eq("payment_status", "pending")
      .maybeSingle();
    
    if (existing) {
      throw new Error("You already have a pending purchase for this package. Please wait for admin approval.");
    }

    // Validate referral code if provided
    let referrerId: string | null = null;
    if (data.referral_code) {
      const { data: refCode } = await supabaseAdmin
        .from("referral_codes" as any)
        .select("user_id")
        .eq("code", data.referral_code.toUpperCase())
        .maybeSingle();
      if (refCode && (refCode as any).user_id !== userId) {
        referrerId = (refCode as any).user_id;
      }
    }
    
    // Calculate expiry date (null if permanent)
    let expiresAt = null;
    if (data.duration_days > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + data.duration_days);
      expiresAt = expiryDate.toISOString();
    }
    
    // Create pending subscription
    const { data: newSub, error } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .insert({
        user_id: userId,
        package_id: data.package_id,
        payment_status: "pending",
        payment_utr: data.payment_utr.toUpperCase(),
        payment_screenshot_url: data.payment_screenshot_url || null,
        expires_at: expiresAt,
        referral_code: data.referral_code?.toUpperCase() || null,
        is_upgrade: false,
      } as any)
      .select("id")
      .single();
    
    if (error) throw new Error(error.message);

    // Record pending referral commission (5%) if referrer found
    if (referrerId && newSub?.id) {
      const commissionAmount = Number(pkg.price_inr) * 0.05;
      await supabaseAdmin.from("referral_commissions" as any).insert({
        referrer_id: referrerId,
        referred_id: userId,
        subscription_id: newSub.id,
        commission_rate: 0.05,
        commission_amount: commissionAmount,
        status: "pending",
      });
    }
    
    // Create admin ticket for approval
    try {
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();
      
      const { data: ticket } = await supabaseAdmin.from("tickets").insert({
        user_id: userId,
        subject: `Data Entry Package Purchase - ${pkg.name}`,
        category: "payment",
        status: "open",
      }).select("id").single();
      
      if (ticket?.id) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: userId,
          is_admin_reply: false,
          message: `Data Entry Package Purchase Request

Package: ${pkg.name}
Daily Tasks: ${pkg.daily_task_limit}
Price: ₹${pkg.price_inr}
Duration: ${data.duration_days === 0 ? 'Permanent' : data.duration_days + ' days'}
UTR: ${data.payment_utr.toUpperCase()}
Referral Code: ${data.referral_code?.toUpperCase() || 'None'}

User: ${userProfile?.full_name || 'Unknown'} (${userProfile?.email || 'No email'})

Please verify payment and approve the subscription.`,
        });
      }
    } catch (e) {
      console.error("Failed to create ticket:", e);
    }
    
    return { ok: true, message: "Purchase submitted. Waiting for admin approval." };
  });

/** Upgrade to a higher-tier package */
export const upgradeDataEntryPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    new_package_id: string;
    payment_utr: string;
    payment_screenshot_url?: string | null;
  }) => {
    if (!input.new_package_id) throw new Error("Package ID required");
    if (!input.payment_utr || input.payment_utr.length < 6) throw new Error("Valid UTR required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId;

    // Get current active subscription
    const { data: currentSub } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("*, package:data_entry_packages(*)")
      .eq("user_id", userId)
      .eq("payment_status", "paid")
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (!currentSub) throw new Error("No active subscription to upgrade");

    // Get new package
    const { data: newPkg } = await (supabaseAdmin
      .from("data_entry_packages") as any)
      .select("*")
      .eq("id", data.new_package_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!newPkg) throw new Error("Package not found or inactive");

    // Verify it's an upgrade (higher price or more tasks)
    const currentPkg = (currentSub as any).package;
    if (newPkg.price_inr <= currentPkg.price_inr) {
      throw new Error("New package must be a higher-tier plan than your current one");
    }

    // Check for existing pending upgrade
    const { data: existing } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("id")
      .eq("user_id", userId)
      .eq("payment_status", "pending")
      .eq("is_upgrade", true)
      .maybeSingle();
    if (existing) throw new Error("You already have a pending upgrade request");

    // Calculate upgrade price (difference)
    const upgradePrice = newPkg.price_inr - currentPkg.price_inr;

    // Create pending upgrade subscription
    const { data: newSub, error } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .insert({
        user_id: userId,
        package_id: data.new_package_id,
        payment_status: "pending",
        payment_utr: data.payment_utr.toUpperCase(),
        payment_screenshot_url: data.payment_screenshot_url || null,
        expires_at: (currentSub as any).expires_at,
        is_upgrade: true,
        previous_subscription_id: (currentSub as any).id,
        upgrade_price: upgradePrice,
      } as any)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    // Create ticket
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();

      const { data: ticket } = await supabaseAdmin.from("tickets").insert({
        user_id: userId,
        subject: `Plan Upgrade - ${currentPkg.name} → ${newPkg.name}`,
        category: "payment",
        status: "open",
      }).select("id").single();

      if (ticket?.id) {
        await supabaseAdmin.from("ticket_messages").insert({
          ticket_id: ticket.id,
          sender_id: userId,
          is_admin_reply: false,
          message: `Plan Upgrade Request

From: ${currentPkg.name} (₹${currentPkg.price_inr})
To: ${newPkg.name} (₹${newPkg.price_inr})
Upgrade Price: ₹${upgradePrice}
UTR: ${data.payment_utr.toUpperCase()}

User: ${profile?.full_name || 'Unknown'} (${profile?.email || 'No email'})

Please verify payment and approve the upgrade.`,
        });
      }
    } catch (e) {
      console.error("Failed to create ticket:", e);
    }

    return { ok: true, upgrade_price: upgradePrice, message: "Upgrade request submitted. Admin will review shortly." };
  });

/** Get my data entry earnings summary */
export const getMyDataEntryEarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId;

    // Get total earnings from wallet transactions
    const { data: earnings } = await supabaseAdmin
      .from("wallet_transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("type", "credit")
      .like("reference", "data-entry%");

    // Get total tasks completed
    const { data: completions } = await supabaseAdmin
      .from("data_entry_daily_completions")
      .select("tasks_completed")
      .eq("user_id", userId);

    const totalEarned = (earnings || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalTasks = (completions || []).reduce((s: number, c: any) => s + Number(c.tasks_completed), 0);

    // Get today's completions
    const today = new Date().toISOString().split("T")[0];
    const { data: todayCompletion } = await supabaseAdmin
      .from("data_entry_daily_completions")
      .select("tasks_completed")
      .eq("user_id", userId)
      .eq("completion_date", today)
      .maybeSingle();

    return {
      total_earned: totalEarned,
      total_tasks_completed: totalTasks,
      today_completed: Number(todayCompletion?.tasks_completed || 0),
    };
  });

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

/** Create new package */
export const adminCreatePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name: string;
    daily_task_limit: number;
    price_inr: number;
    duration_days: number;
    reward_per_task: number;
  }) => {
    if (!input.name || input.name.length < 2) throw new Error("Package name required");
    if (input.daily_task_limit < 1) throw new Error("Daily task limit must be at least 1");
    if (input.price_inr < 1) throw new Error("Price must be positive");
    if (input.reward_per_task < 1) throw new Error("Reward per task must be positive");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    
    const { error } = await (supabaseAdmin
      .from("data_entry_packages" as any))
      .insert({
        name: data.name,
        daily_task_limit: data.daily_task_limit,
        price_inr: data.price_inr,
        duration_days: data.duration_days,
        reward_per_task: data.reward_per_task,
        is_active: true,
      } as any);
    
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update package */
export const adminUpdatePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    name?: string;
    daily_task_limit?: number;
    price_inr?: number;
    duration_days?: number;
    reward_per_task?: number;
    is_active?: boolean;
    display_order?: number;
  }) => {
    if (!input.id) throw new Error("Package ID required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    
    const update: any = {};
    if (data.name) update.name = data.name;
    if (data.daily_task_limit !== undefined) update.daily_task_limit = data.daily_task_limit;
    if (data.price_inr !== undefined) update.price_inr = data.price_inr;
    if (data.duration_days !== undefined) update.duration_days = data.duration_days;
    if (data.reward_per_task !== undefined) update.reward_per_task = data.reward_per_task;
    if (data.is_active !== undefined) update.is_active = data.is_active;
    if (data.display_order !== undefined) update.display_order = data.display_order;
    update.updated_at = new Date().toISOString();
    
    const { error } = await (supabaseAdmin
      .from("data_entry_packages") as any)
      .update(update)
      .eq("id", data.id);
    
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete package */
export const adminDeletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("Package ID required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    
    // Check if any active subscriptions use this package
    const { data: activeSubs } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("id")
      .eq("package_id", data.id)
      .in("payment_status", ["paid", "pending"])
      .limit(1);
    
    if (activeSubs && activeSubs.length > 0) {
      throw new Error("Cannot delete package with active subscriptions. Deactivate it instead.");
    }
    
    const { error } = await (supabaseAdmin
      .from("data_entry_packages") as any)
      .delete()
      .eq("id", data.id);
    
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Get all packages (admin) */
export const adminGetAllPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    
    const { data, error } = await (supabaseAdmin
      .from("data_entry_packages") as any)
      .select("*")
      .order("display_order", { ascending: true });
    
    if (error) throw new Error(error.message);
    return { packages: data || [] };
  });

/** Get all subscriptions (admin) — fetches user profiles separately to avoid missing FK join */
export const adminGetAllSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string } = {}) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);

    let query = (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("*, package:data_entry_packages(*)")
      .order("created_at", { ascending: false });

    if (data?.status) {
      query = query.eq("payment_status", data.status);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw new Error(error.message);

    if (!subscriptions || subscriptions.length === 0) return { subscriptions: [] };

    // Fetch profiles separately (no direct FK from user_data_entry_subscriptions → profiles)
    const userIds: string[] = [...new Set(subscriptions.map((s: any) => s.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

    const enriched = subscriptions.map((s: any) => ({
      ...s,
      user: profileMap[s.user_id] || { full_name: "Unknown", email: s.user_id },
    }));

    return { subscriptions: enriched };
  });

/** Approve subscription (also pays out referral commission) */
export const adminApproveSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subscription_id: string }) => {
    if (!input.subscription_id) throw new Error("Subscription ID required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const adminId = (context as any).userId;
    
    const { error } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .update({
        payment_status: "paid",
        admin_approved_by: adminId,
        admin_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.subscription_id)
      .eq("payment_status", "pending");
    
    if (error) throw new Error(error.message);

    // Pay out pending referral commission for this subscription
    try {
      const { data: commission } = await supabaseAdmin
        .from("referral_commissions" as any)
        .select("id, referrer_id, commission_amount")
        .eq("subscription_id", data.subscription_id)
        .eq("status", "pending")
        .maybeSingle();

      if (commission) {
        const { creditWalletInternal } = await import("./wallet.server");
        await creditWalletInternal({
          user_id: (commission as any).referrer_id,
          wallet: "incentive",
          amount: Number((commission as any).commission_amount),
          reference: `referral-${data.subscription_id}`,
          description: `Referral commission for package subscription`,
        });
        await supabaseAdmin
          .from("referral_commissions" as any)
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", (commission as any).id);
        // Increment referrer stats
        await supabaseAdmin.rpc("increment_referral_stats" as any, {
          p_user_id: (commission as any).referrer_id,
          p_amount: Number((commission as any).commission_amount),
        }).maybeSingle();
      }
    } catch (e) {
      console.error("Referral commission payout failed:", e);
    }

    return { ok: true };
  });

/** Cancel subscription */
export const adminCancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subscription_id: string }) => {
    if (!input.subscription_id) throw new Error("Subscription ID required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    
    const { error } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .update({
        payment_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.subscription_id);
    
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Extend subscription */
export const adminExtendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { subscription_id: string; days: number }) => {
    if (!input.subscription_id) throw new Error("Subscription ID required");
    if (!input.days || input.days < 1) throw new Error("Days must be positive");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    
    // Get current subscription
    const { data: sub } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .select("expires_at")
      .eq("id", data.subscription_id)
      .single();
    
    let newExpiry: string;
    if (sub?.expires_at) {
      const currentExpiry = new Date(sub.expires_at);
      currentExpiry.setDate(currentExpiry.getDate() + data.days);
      newExpiry = currentExpiry.toISOString();
    } else {
      // If permanent, make it time-limited
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + data.days);
      newExpiry = newDate.toISOString();
    }
    
    const { error } = await (supabaseAdmin
      .from("user_data_entry_subscriptions") as any)
      .update({
        expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.subscription_id);
    
    if (error) throw new Error(error.message);
    return { ok: true, new_expires_at: newExpiry };
  });

/** Get or create referral code for current user */
export const getMyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId;
    const { data, error } = await supabaseAdmin.rpc("get_or_create_referral_code" as any, { p_user_id: userId });
    if (error) throw new Error(error.message);
    // Get stats
    const { data: stats } = await supabaseAdmin
      .from("referral_codes" as any)
      .select("code, total_referrals, total_earned")
      .eq("user_id", userId)
      .maybeSingle();
    // Get commission history (without FK join - fetch separately)
    const { data: commissions } = await (supabaseAdmin
      .from("referral_commissions") as any)
      .select("commission_amount, status, created_at, referred_id")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    // Fetch referred user names separately
    const referredIds = [...new Set((commissions || []).map((c: any) => c.referred_id).filter(Boolean))];
    const { data: referredProfiles } = referredIds.length > 0 ? await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", referredIds) : { data: [] };
    const profileMap = Object.fromEntries((referredProfiles || []).map((p: any) => [p.id, p.full_name]));
    const commissionsWithNames = (commissions || []).map((c: any) => ({
      ...c,
      referred_name: profileMap[c.referred_id] || "Unknown",
    }));
    return {
      code: (stats as any)?.code || data,
      total_referrals: (stats as any)?.total_referrals || 0,
      total_earned: Number((stats as any)?.total_earned || 0),
      commissions: commissionsWithNames as any[],
    };
  });

/** Admin: run daily maintenance (expire subs + rollover pool) */
export const adminRunMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    const { data, error } = await supabaseAdmin.rpc("run_daily_data_entry_maintenance" as any);
    if (error) throw new Error(error.message);
    return { result: data };
  });

/** Admin: get expiring subscriptions */
export const adminGetExpiringSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days_ahead?: number } = {}) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    const { data: rows, error } = await supabaseAdmin
      .rpc("get_expiring_subscriptions" as any, { days_ahead: data?.days_ahead ?? 3 });
    if (error) throw new Error(error.message);
    return { subscriptions: rows || [] };
  });

/** Admin: get analytics */
export const adminGetDataEntryAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    const { data, error } = await supabaseAdmin.rpc("get_data_entry_analytics" as any);
    if (error) throw new Error(error.message);
    return { analytics: data as any };
  });

/** Admin: get referral commission overview */
export const adminGetReferralOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    // Get commissions without FK joins (schema cache doesn't have FK relationships)
    const { data: commissions, error } = await (supabaseAdmin
      .from("referral_commissions") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    // Get top referrers
    const { data: topReferrers } = await (supabaseAdmin
      .from("referral_codes") as any)
      .select("code, total_referrals, total_earned, user_id")
      .order("total_earned", { ascending: false })
      .limit(10);
    // Fetch profiles separately for both commissions and top referrers
    const userIds = [...new Set([
      ...(commissions || []).map((c: any) => c.referrer_id),
      ...(commissions || []).map((c: any) => c.referred_id),
      ...(topReferrers || []).map((r: any) => r.user_id),
    ].filter(Boolean))];
    const { data: profiles } = userIds.length > 0 ? await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds) : { data: [] };
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    // Enrich commissions with user data
    const enrichedCommissions = (commissions || []).map((c: any) => ({
      ...c,
      referrer: profileMap[c.referrer_id] || { full_name: "Unknown", email: "" },
      referred: profileMap[c.referred_id] || { full_name: "Unknown", email: "" },
    }));
    // Enrich top referrers with user data
    const enrichedReferrers = (topReferrers || []).map((r: any) => ({
      ...r,
      user: profileMap[r.user_id] || { full_name: "Unknown", email: "" },
    }));
    return { commissions: enrichedCommissions || [], top_referrers: enrichedReferrers || [] };
  });
