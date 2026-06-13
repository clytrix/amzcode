import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Internal helper — service-role only. Import only from other server modules. */
export async function creditWalletInternal(args: {
  user_id: string;
  wallet: "salary" | "incentive";
  amount: number;
  reference?: string;
  description?: string;
}) {
  if (!args.amount || args.amount <= 0) throw new Error("amount must be positive");
  
  // First insert the transaction
  const { error: txError } = await supabaseAdmin.from("wallet_transactions").insert({
    user_id: args.user_id,
    wallet: args.wallet,
    amount: args.amount,
    type: "credit",
    reference: args.reference || null,
    description: args.description || null,
  } as any);
  
  if (txError && !/duplicate key|unique constraint/i.test(txError.message)) {
    throw new Error(txError.message);
  }
  
  // Then update the wallet balance
  const balanceColumn = args.wallet === "salary" ? "salary_balance" : "incentive_balance";
  const { error: walletError } = await supabaseAdmin.rpc("increment_wallet_balance" as any, {
    p_user_id: args.user_id,
    p_column: balanceColumn,
    p_amount: args.amount,
  });
  
  // Fallback: if RPC doesn't exist, update directly
  if (walletError) {
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select(balanceColumn)
      .eq("user_id", args.user_id)
      .maybeSingle();
    
    const currentBalance = Number((wallet as any)?.[balanceColumn] || 0);
    const newBalance = currentBalance + args.amount;
    
    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .upsert({
        user_id: args.user_id,
        [balanceColumn]: newBalance,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
    
    if (updateError && !/duplicate key|unique constraint/i.test(updateError.message)) {
      throw new Error(updateError.message);
    }
  }
}

export async function debitWalletInternal(args: {
  user_id: string;
  wallet: "salary" | "incentive";
  amount: number;
  type?: "withdrawal" | "debit";
  reference?: string;
  description?: string;
}) {
  if (!args.amount || args.amount <= 0) throw new Error("amount must be positive");
  
  // Check balance first
  const { data: w } = await supabaseAdmin
    .from("wallets")
    .select("salary_balance,incentive_balance")
    .eq("user_id", args.user_id)
    .maybeSingle();
  const bal =
    args.wallet === "salary" ? Number(w?.salary_balance || 0) : Number(w?.incentive_balance || 0);
  if (bal < args.amount) throw new Error(`Insufficient ${args.wallet} balance`);
  
  // Insert transaction
  const { error: txError } = await supabaseAdmin.from("wallet_transactions").insert({
    user_id: args.user_id,
    wallet: args.wallet,
    amount: args.amount,
    type: args.type || "debit",
    reference: args.reference || null,
    description: args.description || null,
  } as any);
  if (txError) throw new Error(txError.message);
  
  // Update wallet balance (decrement)
  const balanceColumn = args.wallet === "salary" ? "salary_balance" : "incentive_balance";
  const { error: walletError } = await supabaseAdmin.rpc("decrement_wallet_balance" as any, {
    p_user_id: args.user_id,
    p_column: balanceColumn,
    p_amount: args.amount,
  });
  
  // Fallback: if RPC doesn't exist, update directly
  if (walletError) {
    const newBalance = bal - args.amount;
    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .upsert({
        user_id: args.user_id,
        [balanceColumn]: newBalance,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "user_id" });
    
    if (updateError && !/duplicate key|unique constraint/i.test(updateError.message)) {
      throw new Error(updateError.message);
    }
  }
}
