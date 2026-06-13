import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { inr } from "@/lib/currency";
import { JobRequiredGate } from "@/components/job-required-gate";
import { Wallet, TrendingUp, Calendar, AlertTriangle, Sparkles, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { getMyWallet } from "@/server/wallet.functions";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export const Route = createFileRoute("/dashboard/earnings")({
  component: () => (
    <JobRequiredGate feature="Salary & Incentives">
      <SalaryPage />
    </JobRequiredGate>
  ),
});

function SalaryPage() {
  const { user } = useAuth();
  const [pkg, setPkg] = useState<any>(null);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [pocket, setPocket] = useState<any[]>([]);
  const [withdrawn, setWithdrawn] = useState(0);
  const [legacyEarnings, setLegacyEarnings] = useState(0);
  const [walletData, setWalletData] = useState<{ wallet: { salary_balance: number; incentive_balance: number }; transactions: any[] } | null>(null);

  const loadData = async () => {
    if (!user) return;
    const [pk, ds, ip, wd, le, wallet] = await Promise.all([
      supabase.from("employment_packages").select("*").eq("user_id", user.id).eq("is_active", true).order("starts_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("salary_disbursements").select("*").eq("user_id", user.id).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(24),
      supabase.from("incentive_pocket").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawals").select("amount").eq("user_id", user.id).eq("status", "paid"),
      supabase.from("earnings").select("amount").eq("user_id", user.id),
      getMyWallet().catch(() => null),
    ]);
    setPkg(pk.data);
    setDisbursements(ds.data || []);
    setPocket(ip.data || []);
    setWithdrawn((wd.data || []).reduce((s, r) => s + Number(r.amount), 0));
    setLegacyEarnings((le.data || []).reduce((s, r) => s + Number(r.amount), 0));
    if (wallet) setWalletData(wallet as any);
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  // Auto-refresh on window focus (when user comes back from data entry)
  useEffect(() => {
    const handleFocus = () => {
      void loadData();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  // Refresh every 30 seconds while on page
  useEffect(() => {
    const interval = setInterval(() => {
      void loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const monthly = Number(pkg?.monthly_salary || 0);
  const pocketTotal = pocket.reduce((s, r) => s + Number(r.amount || 0), 0);
  const pocketHours = pocket.reduce((s, r) => s + Number(r.hours || 0), 0);
  const heldTotal = disbursements.filter((d) => d.status === "held" || d.status === "on_hold_kyc").reduce((s, r) => s + Number(r.net_amount || 0), 0);

  const salaryBalance = Number(walletData?.wallet.salary_balance || 0);
  const incentiveBalance = Number(walletData?.wallet.incentive_balance || 0);
  const totalAvailable = salaryBalance + incentiveBalance;
  const recentTx = walletData?.transactions || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Salary &amp; Incentives</h1>
        <p className="text-sm text-muted-foreground">Your monthly salary, overtime credits, and disbursement history.</p>
      </div>

      {!pkg && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
          You don't have an active employment package yet.{" "}
          <Link to="/jobs" className="font-bold text-primary hover:underline">Browse jobs</Link> to apply.
        </div>
      )}

      {heldTotal > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <b>Salary on hold — {inr(heldTotal)}.</b>{" "}
            Complete <Link to="/dashboard/kyc" className="font-bold text-primary hover:underline">KYC verification</Link> to release pending payments.
          </div>
        </div>
      )}

      {/* Wallet balances — available to withdraw */}
      <div className="rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Available to withdraw</div>
            <div className="mt-1 text-3xl font-bold text-primary">{inr(totalAvailable)}</div>
          </div>
          <Link to="/dashboard/withdrawals" className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">
            Withdraw →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Wallet className="h-4 w-4" /> Salary wallet
            </div>
            <div className="mt-1 text-2xl font-bold">{inr(salaryBalance)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Daily salary accruals</div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Incentive wallet
            </div>
            <div className="mt-1 text-2xl font-bold">{inr(incentiveBalance)}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Overtime + data-entry rewards</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Wallet className="h-4 w-4" />} label="Monthly salary" value={inr(monthly)} hint={pkg ? "Active package" : "Not set"} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Incentive pocket" value={inr(pocketTotal)} hint={`${pocketHours.toFixed(2)} hrs overtime`} highlight />
        <Stat icon={<Calendar className="h-4 w-4" />} label="Withdrawn (paid)" value={inr(withdrawn)} hint="Lifetime" />
        <Stat icon={<Wallet className="h-4 w-4" />} label="Legacy bonus credits" value={inr(legacyEarnings)} hint="One-off bonuses" />
      </div>

      {/* Recent wallet transactions */}
      {recentTx.length > 0 && (
        <div className="rounded-md border bg-card shadow-sm">
          <div className="border-b px-4 py-2 text-sm font-bold">Recent wallet activity</div>
          {recentTx.slice(0, 10).map((t) => {
            const isCredit = t.type === "credit" || t.type === "refund" || (t.type === "adjustment" && Number(t.amount) > 0);
            return (
              <div key={t.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0 text-sm">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-1.5 ${isCredit ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {isCredit ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                  </div>
                  <div>
                    <div className="font-semibold">{t.description || t.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("en-IN")} · <span className="capitalize">{t.wallet} wallet</span>
                    </div>
                  </div>
                </div>
                <div className={`font-bold ${isCredit ? "text-success" : "text-destructive"}`}>
                  {isCredit ? "+" : "−"}{inr(Math.abs(Number(t.amount)))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-md border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-bold">
          <span>Recent salary disbursements</span>
          <Link to="/dashboard/salary-slips" className="text-xs font-normal text-primary hover:underline">View slips →</Link>
        </div>
        {disbursements.length === 0 && <div className="p-6 text-sm text-muted-foreground">No disbursements yet. Your first salary will appear here at month-end.</div>}
        {disbursements.map((d) => (
          <div key={d.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0 text-sm">
            <div>
              <div className="font-bold">{MONTHS[d.period_month - 1]} {d.period_year}</div>
              <div className="text-xs text-muted-foreground">
                Basic {inr(d.basic_amount)} + OT {inr(d.overtime_amount)} + Bonus {inr(d.bonus)} − Deductions {inr(d.deductions)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded px-2 py-0.5 text-xs font-bold capitalize ${
                d.status === "paid" ? "bg-success/15 text-success"
                : d.status === "approved" ? "bg-primary/15 text-primary"
                : d.status === "held" || d.status === "on_hold_kyc" ? "bg-destructive/15 text-destructive"
                : "bg-secondary"
              }`}>{String(d.status).replace(/_/g, " ")}</span>
              <span className="font-bold text-success">{inr(d.net_amount)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <div className="border-b px-4 py-2 text-sm font-bold">Incentive pocket history</div>
        {pocket.length === 0 && <div className="p-6 text-sm text-muted-foreground">No incentives credited yet. Work beyond 8h/day to earn overtime.</div>}
        {pocket.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b px-4 py-3 last:border-0 text-sm">
            <div>
              <div className="font-semibold capitalize">{p.source}{p.notes ? ` · ${p.notes}` : ""}</div>
              <div className="text-xs text-muted-foreground">{new Date(p.date || p.created_at).toLocaleDateString("en-IN")} · {Number(p.hours || 0).toFixed(2)} hrs</div>
            </div>
            <div className="font-bold text-success">+{inr(p.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint, highlight }: { icon: React.ReactNode; label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-4 shadow-sm ${highlight ? "bg-primary/10 border-primary/40" : "bg-card"}`}>
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
