import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import {
  Users, TrendingUp, CheckCircle2, Clock, BarChart2, Trophy,
  Loader2, RefreshCw, AlertTriangle, Play,
} from "lucide-react";
import {
  adminGetDataEntryAnalytics,
  adminRunMaintenance,
  adminGetExpiringSubscriptions,
  adminGetReferralOverview,
} from "@/server/data-entry-packages.functions";

export const Route = createFileRoute("/admin/data-entry-analytics")({
  component: AdminDataEntryAnalytics,
});

function AdminDataEntryAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningMaint, setRunningMaint] = useState(false);
  const [maintResult, setMaintResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "expiring" | "referrals">("overview");

  useEffect(() => { void loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [a, e, r] = await Promise.all([
        adminGetDataEntryAnalytics(),
        adminGetExpiringSubscriptions({ data: { days_ahead: 7 } }),
        adminGetReferralOverview(),
      ]);
      setAnalytics(a.analytics);
      setExpiring(e.subscriptions);
      setReferrals(r);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const runMaintenance = async () => {
    setRunningMaint(true);
    try {
      const r = await adminRunMaintenance();
      setMaintResult(r.result);
      toast.success("Maintenance completed");
      await loadAll();
    } catch (err: any) {
      toast.error(err?.message || "Maintenance failed");
    } finally {
      setRunningMaint(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Entry Analytics</h1>
          <p className="text-sm text-muted-foreground">Performance overview, expiring subscriptions, referrals</p>
        </div>
        <div className="flex gap-2">
          <AzButton variant="outline" size="sm" onClick={loadAll}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </AzButton>
          <AzButton variant="brand" size="sm" onClick={runMaintenance} disabled={runningMaint}>
            {runningMaint ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
            Run Maintenance
          </AzButton>
        </div>
      </div>

      {maintResult && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
          <b>Maintenance Result:</b> Expired {maintResult.expired_subscriptions} subscriptions,
          created {maintResult.pool_items_created} pool items.
          <span className="text-muted-foreground ml-2 text-xs">Ran at {new Date(maintResult.ran_at).toLocaleString()}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Users className="h-5 w-5 text-primary" />} label="Active Subscribers" value={analytics?.active_subscribers ?? 0} />
        <KpiCard icon={<Clock className="h-5 w-5 text-warning" />} label="Pending Approvals" value={analytics?.pending_approvals ?? 0} warning={analytics?.pending_approvals > 0} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-success" />} label="Today's Completions" value={analytics?.today_completions ?? 0} />
        <KpiCard icon={<BarChart2 className="h-5 w-5 text-primary" />} label="Avg Accuracy" value={analytics?.avg_accuracy ? `${analytics.avg_accuracy}%` : "—"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard icon={<TrendingUp className="h-5 w-5 text-success" />} label="Total Completed Tasks" value={analytics?.completed_submissions ?? 0} />
        <KpiCard icon={<TrendingUp className="h-5 w-5 text-warning" />} label="Total Rewards Credited" value={inr(Number(analytics?.total_earned ?? 0))} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["overview", "expiring", "referrals"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold capitalize border-b-2 transition-colors ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "expiring" ? `Expiring Soon (${expiring.length})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Earners */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" /> Top Earners
            </div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Tasks Done</th>
                  <th className="px-4 py-2 text-left">Avg Accuracy</th>
                  <th className="px-4 py-2 text-left">Total Earned</th>
                </tr>
              </thead>
              <tbody>
                {(analytics?.top_earners || []).map((u: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2 text-muted-foreground font-bold">#{i + 1}</td>
                    <td className="px-4 py-2">
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-2">{u.tasks_done}</td>
                    <td className="px-4 py-2">{u.avg_accuracy ? `${u.avg_accuracy}%` : "—"}</td>
                    <td className="px-4 py-2 font-bold text-success">{inr(Number(u.total_earned))}</td>
                  </tr>
                ))}
                {!analytics?.top_earners?.length && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 14-day trend */}
          {analytics?.daily_trend?.length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b font-bold">14-Day Completion Trend</div>
              <table className="w-full text-sm">
                <thead className="bg-secondary/40">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Completions</th>
                    <th className="px-4 py-2 text-left">Rewards Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.daily_trend.map((d: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="px-4 py-2">{new Date(d.day).toLocaleDateString()}</td>
                      <td className="px-4 py-2">{d.completions}</td>
                      <td className="px-4 py-2 font-bold">{inr(Number(d.earned))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Expiring Tab */}
      {activeTab === "expiring" && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Subscriptions Expiring in 7 Days
          </div>
          {expiring.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No subscriptions expiring soon.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Package</th>
                  <th className="px-4 py-2 text-left">Expires</th>
                  <th className="px-4 py-2 text-left">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((s: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </td>
                    <td className="px-4 py-2">{s.package_name}</td>
                    <td className="px-4 py-2">{new Date(s.expires_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <span className={`font-bold ${s.days_remaining <= 1 ? "text-destructive" : s.days_remaining <= 3 ? "text-warning" : ""}`}>
                        {s.days_remaining}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Referrals Tab */}
      {activeTab === "referrals" && (
        <div className="space-y-6">
          {/* Top referrers */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b font-bold">Top Referrers</div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Code</th>
                  <th className="px-4 py-2 text-left">Referrals</th>
                  <th className="px-4 py-2 text-left">Total Earned</th>
                </tr>
              </thead>
              <tbody>
                {(referrals?.top_referrers || []).map((r: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">
                      <p className="font-medium">{(r.profiles as any)?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{(r.profiles as any)?.email}</p>
                    </td>
                    <td className="px-4 py-2 font-mono font-bold">{r.code}</td>
                    <td className="px-4 py-2">{r.total_referrals}</td>
                    <td className="px-4 py-2 font-bold text-success">{inr(Number(r.total_earned))}</td>
                  </tr>
                ))}
                {!referrals?.top_referrers?.length && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No referrals yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Commission log */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b font-bold">Commission Log</div>
            <table className="w-full text-sm">
              <thead className="bg-secondary/40">
                <tr>
                  <th className="px-4 py-2 text-left">Referrer</th>
                  <th className="px-4 py-2 text-left">Referred</th>
                  <th className="px-4 py-2 text-left">Commission</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {(referrals?.commissions || []).map((c: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="px-4 py-2">{(c.referrer as any)?.full_name}</td>
                    <td className="px-4 py-2">{(c.referred as any)?.full_name}</td>
                    <td className="px-4 py-2 font-bold">{inr(Number(c.commission_amount))}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-bold ${c.status === "paid" ? "text-success" : c.status === "cancelled" ? "text-destructive" : "text-warning"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!referrals?.commissions?.length && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No commissions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, warning }: { icon: React.ReactNode; label: string; value: any; warning?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-4 flex items-center gap-3 ${warning ? "border-warning/40 bg-warning/5" : ""}`}>
      <div className="rounded-lg bg-secondary p-2">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
