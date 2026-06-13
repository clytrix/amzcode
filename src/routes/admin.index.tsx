import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase, Users, FileText, Banknote, Ticket, ShieldCheck,
  TrendingUp, Sparkles, Crown, Clock, ListChecks, ArrowRight, BarChart3,
} from "lucide-react";
import { inr } from "@/lib/currency";

export const Route = createFileRoute("/admin/")({ component: AdminOverview });

type Stats = {
  activeJobs: number;
  pendingApps: number;
  employees: number;
  pendingKyc: number;
  pendingWithdrawals: number;
  openTickets: number;
  totalPaidOut: number;
  totalEarnings: number;
  attendanceToday: number;
  hoursToday: number;
  tasksActive: number;
  tasksDoneMonth: number;
};

function AdminOverview() {
  const [s, setS] = useState<Stats>({
    activeJobs: 0, pendingApps: 0, employees: 0, pendingKyc: 0,
    pendingWithdrawals: 0, openTickets: 0, totalPaidOut: 0, totalEarnings: 0,
    attendanceToday: 0, hoursToday: 0, tasksActive: 0, tasksDoneMonth: 0,
  });

  useEffect(() => {
    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const monthIso = monthStart.toISOString();

      const [jobs, apps, emps, kyc, withd, tix, paid, att, tActive, tDone, wallets, salaryDisbursed, dataEntrySubs] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("job_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "documents_submitted"),
        supabase.from("withdrawals").select("amount").eq("status", "pending"),
        supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
        supabase.from("withdrawals").select("amount").eq("status", "paid"),
        supabase.from("attendance").select("hours_worked").eq("work_date", today),
        supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["assigned", "in_progress", "submitted"]),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "approved").gte("updated_at", monthIso),
        supabase.from("wallets").select("salary_balance, incentive_balance"),
        supabase.from("salary_disbursements").select("net_amount").eq("status", "paid"),
        supabase.from("data_entry_submissions").select("id").eq("is_done", true).gte("created_at", monthIso),
      ]);

      // Calculate totals from wallet system
      const totalWalletBalance = (wallets.data || []).reduce((acc: number, r: any) => {
        return acc + Number(r.salary_balance || 0) + Number(r.incentive_balance || 0);
      }, 0);
      const totalDisbursed = (salaryDisbursed.data || []).reduce((acc: number, r: any) => acc + Number(r.net_amount || 0), 0);
      const totalPaidOut = (paid.data || []).reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0);
      const totalEarnings = totalWalletBalance + totalPaidOut + totalDisbursed;

      setS({
        activeJobs: jobs.count || 0,
        pendingApps: apps.count || 0,
        employees: emps.count || 0,
        pendingKyc: kyc.count || 0,
        pendingWithdrawals: (withd.data || []).reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0),
        openTickets: tix.count || 0,
        totalPaidOut: totalPaidOut + totalDisbursed,
        totalEarnings: totalEarnings,
        attendanceToday: (att.data || []).length,
        hoursToday: (att.data || []).reduce((acc: number, r: any) => acc + Number(r.hours_worked || 0), 0),
        tasksActive: tActive.count || 0,
        tasksDoneMonth: tDone.count || 0,
      });
    })();
  }, []);

  const actionItems = s.pendingApps + s.pendingKyc + s.openTickets;
  const payoutNet = s.pendingWithdrawals;

  return (
    <div className="space-y-6">
      {/* HERO */}
      <section
        className="relative overflow-hidden rounded-xl p-6 text-nav-foreground shadow-[var(--shadow-elegant)] sm:p-8"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
              <Crown className="h-3.5 w-3.5 text-primary" /> Admin Console
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Mission control</h1>
            <p className="mt-2 max-w-lg text-sm opacity-85">
              {actionItems > 0
                ? <><b className="text-warning-foreground">{actionItems} item{actionItems === 1 ? "" : "s"}</b> need your attention today.</>
                : "Everything is up to date. Great work!"}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
              <Chip>{s.attendanceToday} on shift today</Chip>
              <Chip>{s.hoursToday.toFixed(1)} hrs logged</Chip>
              <Chip>{s.tasksActive} tasks active</Chip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link to="/admin/analytics" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition hover:opacity-90">
              <BarChart3 className="h-4 w-4" /> Performance reports
            </Link>
            <Link to="/admin/jobs" className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold backdrop-blur transition hover:bg-white/20">
              Post a job <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat Icon={Banknote} tint="success" label="Total earnings credited" value={inr(s.totalEarnings)} sub={`${inr(s.totalPaidOut)} paid out`} />
        <Stat Icon={TrendingUp} tint="primary" label="Pending payouts" value={inr(payoutNet)} sub={`${s.pendingWithdrawals > 0 ? "Awaiting approval" : "All clear"}`} highlight={payoutNet > 0} />
        <Stat Icon={ListChecks} tint="info" label="Tasks completed (mo)" value={String(s.tasksDoneMonth)} sub={`${s.tasksActive} in flight`} />
        <Stat Icon={Users} tint="warning" label="Employees" value={String(s.employees)} sub={`${s.activeJobs} active jobs`} />
      </section>

      {/* OPERATIONAL QUEUE */}
      <section className="grid gap-4 lg:grid-cols-3">
        <QueueCard
          to="/admin/applications"
          Icon={FileText}
          label="Pending applications"
          count={s.pendingApps}
          tone={s.pendingApps > 0 ? "warning" : "ok"}
          cta="Review"
        />
        <QueueCard
          to="/admin/kyc"
          Icon={ShieldCheck}
          label="KYC awaiting verification"
          count={s.pendingKyc}
          tone={s.pendingKyc > 0 ? "warning" : "ok"}
          cta="Verify"
        />
        <QueueCard
          to="/admin/tickets"
          Icon={Ticket}
          label="Open support tickets"
          count={s.openTickets}
          tone={s.openTickets > 0 ? "warning" : "ok"}
          cta="Respond"
        />
      </section>

      {/* QUICK LINKS */}
      <section className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Quick actions</h2>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QL to="/admin/jobs" Icon={Briefcase} label="Manage jobs" />
          <QL to="/admin/tasks" Icon={ListChecks} label="Assign tasks" />
          <QL to="/admin/attendance" Icon={Clock} label="Attendance log" />
          <QL to="/admin/withdrawals" Icon={Banknote} label="Process payouts" />
          <QL to="/admin/employees" Icon={Users} label="Employees" />
          <QL to="/admin/salary-slips" Icon={FileText} label="Salary slips" />
          <QL to="/admin/data-entry" Icon={ListChecks} label="Data entry pool" />
          <QL to="/admin/analytics" Icon={BarChart3} label="Analytics" />
        </div>
      </section>
    </div>
  );
}

function Chip({ children }: { children: any }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">{children}</span>;
}

function Stat({ Icon, label, value, sub, tint, highlight }: { Icon: any; label: string; value: string; sub?: string; tint: "primary"|"success"|"warning"|"info"; highlight?: boolean }) {
  const tintMap = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    info: "bg-nav/10 text-nav",
  } as const;
  return (
    <div className={`group rounded-xl border p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elevated)] ${highlight ? "border-primary/40" : ""}`} style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md transition group-hover:scale-105 ${tintMap[tint]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function QueueCard({ to, Icon, label, count, tone, cta }: { to: string; Icon: any; label: string; count: number; tone: "ok" | "warning"; cta: string }) {
  return (
    <Link to={to as any} className={`group flex items-center justify-between rounded-xl border p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elevated)] ${tone === "warning" ? "border-warning/40 bg-warning/5" : "bg-card"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${tone === "warning" ? "bg-warning/20 text-warning-foreground" : "bg-success/15 text-success"}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{count}</div>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:underline">
        {cta} <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

function QL({ to, Icon, label }: { to: string; Icon: any; label: string }) {
  return (
    <Link to={to as any} className="flex items-center justify-between rounded-md border bg-secondary/50 px-3 py-2 text-sm font-semibold transition hover:bg-accent hover:shadow-sm">
      <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
