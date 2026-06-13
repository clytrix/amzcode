import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Wallet, ListChecks, ShieldCheck, Banknote,
  Briefcase, ArrowRight, Sparkles, TrendingUp, Clock, CheckCircle2, Lock,
  FileText, Keyboard, X, Crown,
} from "lucide-react";
import { inr } from "@/lib/currency";
import { useJobApproval } from "@/hooks/use-job-approval";
import { getMyWallet } from "@/server/wallet.functions";
import { getMyDataEntryToday } from "@/server/data-entry.functions";

export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

type ActivityItem = { id: string; title: string; subtitle: string; amount?: number; when: string; tone: "success" | "warning" | "info" };

function DashboardHome() {
  const { user } = useAuth();
  const { approved: jobApproved, totalCount, pendingCount, loading } = useJobApproval();
  const [stats, setStats] = useState({
    earnings: 0, monthEarnings: 0, pendingTasks: 0, completedTasks: 0,
    kycStatus: "not_started" as string, pendingWithdrawals: 0, paidOut: 0, applications: 0,
    heldSalary: 0, dataEntryCompleted: 0, dataEntryPending: 0, dataEntryEarnings: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [walletData, setWalletData] = useState<{ wallet: { salary_balance: number; incentive_balance: number }; transactions: any[] } | null>(null);
  const [showJobPopup, setShowJobPopup] = useState(false);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthIso = monthStart.toISOString();

      const [tPending, tDone, k, paid, apps, p, recentTasks, held, wallet, dataEntryPool, salaryDisbursed, monthTx] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["assigned", "in_progress"]),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "approved"),
        supabase.from("kyc_submissions").select("status").eq("user_id", user.id).maybeSingle(),
        supabase.from("withdrawals").select("amount").eq("user_id", user.id).eq("status", "paid"),
        supabase.from("job_applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("tasks").select("id, title, status, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(3),
        supabase.from("salary_disbursements").select("net_amount").eq("user_id", user.id).eq("status", "held"),
        getMyWallet().catch(() => null),
        getMyDataEntryToday().catch(() => ({ pool: [] })),
        supabase.from("salary_disbursements").select("net_amount").eq("user_id", user.id).eq("status", "paid"),
        supabase.from("wallet_transactions").select("*").eq("user_id", user.id).gte("created_at", monthIso).order("created_at", { ascending: false }),
      ]);

      // Calculate wallet-based earnings
      const salaryBal = Number(wallet?.wallet?.salary_balance || 0);
      const incentiveBal = Number(wallet?.wallet?.incentive_balance || 0);
      const totalPaid = (paid.data || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const totalDisbursed = (salaryDisbursed.data || []).reduce((s: number, r: any) => s + Number(r.net_amount || 0), 0);
      const totalEarnings = salaryBal + incentiveBal + totalPaid + totalDisbursed;

      // Data entry stats
      const dePool = dataEntryPool?.pool || [];
      const deCompleted = dePool.filter((i: any) => i.submission?.is_done).length;
      const dePending = dePool.filter((i: any) => !i.submission?.is_done).length;
      const deEarnings = dePool
        .filter((i: any) => i.submission?.is_done)
        .reduce((s: number, i: any) => s + Number(i.reward_amount || 150), 0);

      // Month earnings from wallet transactions
      const monthEarnings = (monthTx.data || []).reduce((s: number, r: any) => {
        return r.type === "credit" || r.type === "refund" ? s + Number(r.amount || 0) : s;
      }, 0);

      setStats({
        earnings: totalEarnings,
        monthEarnings: monthEarnings || (salaryBal + incentiveBal),
        pendingTasks: tPending.count || 0,
        completedTasks: tDone.count || 0,
        kycStatus: (k.data?.status as string) || "not_started",
        pendingWithdrawals: totalPaid > 0 ? 0 : 0, // Calculate from pending withdrawals
        paidOut: totalPaid + totalDisbursed,
        applications: apps.count || 0,
        heldSalary: (held.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0),
        dataEntryCompleted: deCompleted,
        dataEntryPending: dePending,
        dataEntryEarnings: deEarnings,
      });

      setWalletData(wallet as any);
      setProfile(p.data || null);

      // Build activity from wallet transactions and tasks
      const items: ActivityItem[] = [];

      // Add wallet transactions
      (wallet?.transactions || []).slice(0, 5).forEach((r: any) => {
        const isCredit = r.type === "credit" || r.type === "refund";
        items.push({
          id: `tx-${r.id}`,
          title: r.description || (isCredit ? "Credit received" : "Debit"),
          subtitle: `${r.wallet} wallet · ${r.type}`,
          amount: isCredit ? Number(r.amount) : -Number(r.amount),
          when: r.created_at,
          tone: isCredit ? "success" : "info",
        });
      });

      // Add data entry completions
      dePool.filter((i: any) => i.submission?.is_done).slice(0, 3).forEach((i: any) => {
        items.push({
          id: `de-${i.id}`,
          title: "Data entry completed",
          subtitle: `Invoice: ${i.invoice?.vendor_name || "Task"}`,
          amount: Number(i.reward_amount || 150),
          when: i.submission?.done_at || new Date().toISOString(),
          tone: "success",
        });
      });

      (recentTasks.data || []).forEach((r: any) => items.push({
        id: `t-${r.id}`, title: r.title, subtitle: `Task ${r.status.replace(/_/g, " ")}`, when: r.updated_at,
        tone: r.status === "approved" ? "success" : "info",
      }));

      items.sort((a, b) => +new Date(b.when) - +new Date(a.when));
      setActivity(items.slice(0, 6));
    })();
  }, [user]);

  // Show popup for users who haven't applied for a job
  useEffect(() => {
    if (!loading && totalCount === 0 && !hasSeenPopup) {
      const timer = setTimeout(() => setShowJobPopup(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, totalCount, hasSeenPopup]);

  // Use actual wallet balance for available balance
  const salaryBalance = Number(walletData?.wallet?.salary_balance || 0);
  const incentiveBalance = Number(walletData?.wallet?.incentive_balance || 0);
  const balance = salaryBalance + incentiveBalance;
  const firstName = (profile?.full_name || user?.email?.split("@")[0] || "there").split(" ")[0];
  const kycLabel = stats.kycStatus.replace(/_/g, " ");
  const kycApproved = stats.kycStatus === "approved";

  return (
    <div className="space-y-6">
      {/* JOB APPLICATION POPUP - for new signups without any applications */}
      {showJobPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowJobPopup(false); setHasSeenPopup(true); }}>
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Briefcase className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-bold">Welcome to AMZ.Jobs!</h2>
              </div>
              <button
                onClick={() => { setShowJobPopup(false); setHasSeenPopup(true); }}
                className="rounded-full p-1 hover:bg-secondary"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              To start earning with us, you need to apply for a job position first. Once approved, you'll unlock tasks, data entry work, attendance tracking, and salary payouts.
            </p>
            <div className="mt-4 rounded-lg bg-primary/5 p-4">
              <h3 className="text-sm font-bold text-primary">Why apply?</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success" /> Access daily data entry tasks</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success" /> Earn ₹150+ per task completed</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success" /> Monthly salary & incentives</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-success" /> Weekly withdrawals to your bank</li>
              </ul>
            </div>
            <div className="mt-5 flex gap-2">
              <Link
                to="/jobs"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90"
                onClick={() => { setShowJobPopup(false); setHasSeenPopup(true); }}
              >
                <Briefcase className="h-4 w-4" /> Apply for a job
              </Link>
              <button
                onClick={() => { setShowJobPopup(false); setHasSeenPopup(true); }}
                className="rounded-md border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DATA ENTRY PRIORITY BANNER - always visible as main earning feature */}
      <section className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Keyboard className="h-6 w-6" />
            </span>
            <div>
              <h3 className="font-bold text-lg">Data Entry — Our #1 Earning Opportunity</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                Complete daily invoice data entry tasks and earn rewards directly to your wallet. No job approval needed — start earning today!
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-success font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> {stats.dataEntryCompleted} completed today
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-primary font-semibold">
                  <TrendingUp className="h-3 w-3" /> {inr(stats.dataEntryEarnings)} earned
                </span>
                {stats.dataEntryPending > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-warning-foreground font-semibold">
                    <Clock className="h-3 w-3" /> {stats.dataEntryPending} pending
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/dashboard/data-entry" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90">
              <Keyboard className="h-4 w-4" /> Start Data Entry <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/dashboard/data-entry/packages" className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-white/50 px-5 py-2 text-xs font-bold text-primary hover:bg-white/80">
              <Crown className="h-3.5 w-3.5" /> View Plans & Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Salary-hold banner: appears when one or more salary disbursements are
          held — almost always because KYC isn't approved yet. Drives the
          employee straight to KYC. */}
      {stats.heldSalary > 0 && (
        <div className="rounded-xl border-2 border-warning/50 bg-warning/10 p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/25 text-warning-foreground">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold">Salary on hold — complete KYC to release {inr(stats.heldSalary)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your monthly salary was generated but cannot be paid out until your KYC is approved.
                  Complete the verification below to unlock all pending and future disbursements.
                </p>
              </div>
            </div>
            <Link to="/dashboard/kyc" className="inline-flex items-center gap-2 rounded-md bg-warning px-4 py-2 text-xs font-bold text-warning-foreground hover:opacity-90">
              <ShieldCheck className="h-3.5 w-3.5" /> Complete KYC
            </Link>
          </div>
        </div>
      )}
      {!jobApproved && (
        <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary"><Lock className="h-5 w-5" /></span>
              <div>
                <h3 className="font-bold">{totalCount === 0 ? "Apply for a job to unlock the workspace" : pendingCount > 0 ? "Application under review" : "No active approval — apply again"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tasks, attendance, earnings, withdrawals and salary slips unlock the moment an admin approves your job application.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/jobs" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90">
                <Briefcase className="h-3.5 w-3.5" /> Browse jobs
              </Link>
              <Link to="/dashboard/applications" className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-xs font-bold hover:bg-secondary">
                My applications
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* HERO */}
      <section
        className="relative overflow-hidden rounded-xl p-6 text-nav-foreground shadow-[var(--shadow-elegant)] sm:p-8"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-nav-foreground/90 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Employee Hub
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {firstName}.
            </h1>
            <p className="mt-2 max-w-lg text-sm text-nav-foreground/80">
              Here's what's happening with your earnings, tasks and payouts today.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {/* KYC badge only appears once balance has crossed the
                  withdrawal threshold — otherwise we keep the dashboard
                  clean and let employees focus on work. */}
              {balance >= 5000 && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold backdrop-blur ${kycApproved ? "bg-success/25 text-success-foreground" : "bg-warning/25 text-warning-foreground"}`}>
                  <ShieldCheck className="h-3.5 w-3.5" /> KYC: {kycLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-nav-foreground backdrop-blur">
                <Wallet className="h-3.5 w-3.5" /> Balance: {inr(balance)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {balance >= 5000 && !kycApproved ? (
              <Link to="/dashboard/withdrawals" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90">
                Unlock withdrawal <ArrowRight className="h-4 w-4" />
              </Link>
            ) : balance >= 5000 ? (
              <Link to="/dashboard/withdrawals" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90">
                Withdraw earnings <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link to="/dashboard/tasks" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90">
                Open my tasks <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link to="/jobs" className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-nav-foreground backdrop-blur transition hover:bg-white/20">
              Browse jobs
            </Link>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          Icon={Wallet}
          tint="primary"
          label="Total earnings"
          value={inr(stats.earnings)}
          sub={`${inr(stats.monthEarnings)} this month`}
          subIcon={TrendingUp}
        />
        <Stat
          Icon={Banknote}
          tint="success"
          label="Available balance"
          value={inr(balance)}
          sub={`${inr(stats.paidOut)} paid out`}
          subIcon={CheckCircle2}
        />
        <Stat
          Icon={ListChecks}
          tint="info"
          label="Active tasks"
          value={String(stats.pendingTasks)}
          sub={`${stats.completedTasks} approved`}
          subIcon={CheckCircle2}
        />
        <Stat
          Icon={Briefcase}
          tint="warning"
          label="Applications"
          value={String(stats.applications)}
          sub={stats.pendingWithdrawals > 0 ? `${inr(stats.pendingWithdrawals)} payout pending` : "No payout pending"}
          subIcon={Clock}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* RECENT ACTIVITY */}
        <section className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Recent activity</h2>
            <Link to="/dashboard/earnings" className="text-xs font-semibold text-primary hover:underline">View all earnings →</Link>
          </div>
          <ul className="mt-4 space-y-2">
            {activity.length === 0 && (
              <li className="rounded-md border border-dashed bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
                No activity yet — apply to jobs and complete tasks to start earning.
              </li>
            )}
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-md border border-transparent p-3 transition hover:border-border hover:bg-secondary/40">
                <span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  a.tone === "success" ? "bg-success/15 text-success" : a.tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-primary/15 text-primary"
                }`}>
                  {a.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-bold capitalize">{a.title}</div>
                    {a.amount !== undefined && <div className="text-sm font-bold text-success">+{inr(a.amount)}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{a.subtitle} · {new Date(a.when).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* SIDE: quick actions + KYC reminder */}
        <aside className="space-y-4">
          {balance >= 5000 && !kycApproved && (
            <div className="rounded-xl border-2 border-warning/40 bg-warning/10 p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-warning-foreground" />
                <h3 className="text-sm font-bold">Salary on hold — verify KYC</h3>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                You've crossed the {inr(5000)} payout threshold. Complete KYC verification to release your funds.
              </p>
              <Link to="/dashboard/withdrawals" className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90">
                Continue to withdrawal <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-bold">Quick actions</h3>
            <div className="mt-3 grid gap-2">
              <QuickLink to="/jobs" Icon={Briefcase} label="Browse jobs" />
              <QuickLink to="/dashboard/tasks" Icon={ListChecks} label="View tasks" />
              <QuickLink to="/dashboard/data-entry" Icon={FileText} label="Data entry tasks" />
              <QuickLink to="/dashboard/withdrawals" Icon={Banknote} label="Request withdrawal" />
              <QuickLink to="/dashboard/tickets" Icon={ShieldCheck} label="Open support ticket" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ Icon, label, value, sub, subIcon: SubIcon, tint }: {
  Icon: any; label: string; value: string; sub?: string; subIcon?: any;
  tint: "primary" | "success" | "warning" | "info";
}) {
  const tintMap = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    info: "bg-nav/10 text-nav",
  } as const;
  return (
    <div
      className="group rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elevated)]"
      style={{ background: "var(--gradient-card)" }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md transition group-hover:scale-105 ${tintMap[tint]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold capitalize tracking-tight">{value}</div>
      {sub && (
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {SubIcon && <SubIcon className="h-3 w-3" />} {sub}
        </div>
      )}
    </div>
  );
}

function QuickLink({ to, Icon, label }: { to: string; Icon: any; label: string }) {
  return (
    <Link
      to={to as any}
      className="flex items-center justify-between rounded-md border bg-secondary/50 px-3 py-2 text-sm font-semibold transition hover:bg-accent hover:shadow-sm"
    >
      <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
