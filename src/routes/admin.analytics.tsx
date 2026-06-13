import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, ListChecks, Clock, Award, Target } from "lucide-react";
import { inr } from "@/lib/currency";

export const Route = createFileRoute("/admin/analytics")({ component: AnalyticsPage });

type EmployeeRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  hours_30d: number;
  days_present_30d: number;
  tasks_done_30d: number;
  tasks_active: number;
  earnings_30d: number;
  score: number;
};

function AnalyticsPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [totals, setTotals] = useState({ hours: 0, tasks: 0, earnings: 0, employees: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();
      const sinceDate = sinceIso.slice(0, 10);

      const [profilesRes, attRes, tasksDoneRes, tasksActiveRes, earnRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("attendance").select("user_id, hours_worked, work_date").gte("work_date", sinceDate),
        supabase.from("tasks").select("user_id").eq("status", "approved").gte("updated_at", sinceIso),
        supabase.from("tasks").select("user_id").in("status", ["assigned", "in_progress", "submitted"]),
        supabase.from("earnings").select("user_id, amount").gte("created_at", sinceIso),
      ]);

      const profiles = profilesRes.data || [];
      const byUser: Record<string, EmployeeRow> = {};
      for (const p of profiles) {
        byUser[p.id] = {
          user_id: p.id, full_name: p.full_name, email: p.email,
          hours_30d: 0, days_present_30d: 0, tasks_done_30d: 0, tasks_active: 0, earnings_30d: 0, score: 0,
        };
      }
      for (const a of attRes.data || []) {
        const r = byUser[a.user_id]; if (!r) continue;
        r.hours_30d += Number(a.hours_worked || 0);
        if (a.hours_worked != null) r.days_present_30d += 1;
      }
      for (const t of tasksDoneRes.data || []) {
        const r = byUser[t.user_id]; if (!r) continue;
        r.tasks_done_30d += 1;
      }
      for (const t of tasksActiveRes.data || []) {
        const r = byUser[t.user_id]; if (!r) continue;
        r.tasks_active += 1;
      }
      for (const e of earnRes.data || []) {
        const r = byUser[e.user_id]; if (!r) continue;
        r.earnings_30d += Number(e.amount || 0);
      }
      // Composite score: hours/40 + tasks*10 + earnings/1000
      const list = Object.values(byUser).map((r) => ({
        ...r,
        score: Math.round(r.hours_30d * 1.2 + r.tasks_done_30d * 10 + r.earnings_30d / 1000),
      }));
      list.sort((a, b) => b.score - a.score);

      setRows(list);
      setTotals({
        hours: list.reduce((s, r) => s + r.hours_30d, 0),
        tasks: list.reduce((s, r) => s + r.tasks_done_30d, 0),
        earnings: list.reduce((s, r) => s + r.earnings_30d, 0),
        employees: list.filter((r) => r.hours_30d > 0 || r.tasks_done_30d > 0).length,
      });
      setLoading(false);
    })();
  }, []);

  const max = Math.max(1, ...rows.map((r) => r.score));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-sm text-muted-foreground">Last 30 days · attendance, task throughput, and earnings combined into a composite performance score.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI Icon={Clock} tint="primary" label="Hours logged" value={`${totals.hours.toFixed(0)}h`} />
        <KPI Icon={ListChecks} tint="success" label="Tasks completed" value={String(totals.tasks)} />
        <KPI Icon={TrendingUp} tint="warning" label="Earnings paid" value={inr(totals.earnings)} />
        <KPI Icon={Users} tint="info" label="Active employees" value={String(totals.employees)} />
      </section>

      <section className="rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-bold">Employee leaderboard</h2>
            <p className="text-xs text-muted-foreground">Composite score = hours × 1.2 + tasks × 10 + ₹earnings ÷ 1,000</p>
          </div>
          <Award className="h-5 w-5 text-warning" />
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No employees yet.</div>
        ) : (
          <div className="divide-y">
            {rows.map((r, idx) => (
              <div key={r.user_id} className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm">
                <div className="col-span-1 text-center">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    idx === 0 ? "bg-warning text-warning-foreground" : idx < 3 ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                  }`}>{idx + 1}</span>
                </div>
                <div className="col-span-3">
                  <div className="font-bold truncate">{r.full_name || "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                </div>
                <div className="col-span-5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Score</span>
                    <span className="font-bold text-foreground tabular-nums">{r.score}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-[var(--gradient-brand)]" style={{ width: `${(r.score / max) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{r.hours_30d.toFixed(1)}h</span>
                    <span>{r.days_present_30d}d present</span>
                    <span>{r.tasks_done_30d} tasks done</span>
                    <span>{r.tasks_active} active</span>
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="text-base font-bold text-success tabular-nums">{inr(r.earnings_30d)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">earned</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Recommendations</h2>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Consider bonus payouts to the top 3 performers this month.</li>
          <li>• Reach out to employees with &lt; 10 hours logged in the last 30 days.</li>
          <li>• Reassign stale "in progress" tasks to free up the work queue.</li>
        </ul>
      </section>
    </div>
  );
}

function KPI({ Icon, label, value, tint }: { Icon: any; label: string; value: string; tint: "primary" | "success" | "warning" | "info" }) {
  const tintMap = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    info: "bg-nav/10 text-nav",
  } as const;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elevated)]" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tintMap[tint]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}
