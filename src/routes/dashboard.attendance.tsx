import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { Clock, Calendar, TrendingUp, LogIn, LogOut, Coffee, Zap } from "lucide-react";
import { JobRequiredGate } from "@/components/job-required-gate";

export const Route = createFileRoute("/dashboard/attendance")({ component: AttendancePage });

type Row = {
  id: string;
  work_date: string;
  check_in_at: string;
  check_out_at: string | null;
  hours_worked: number | null;
  notes: string | null;
};

const todayIso = () => {
  const d = new Date();
  const tz = new Date(d.getTime() + (5.5 * 60 - d.getTimezoneOffset()) * 60_000);
  return tz.toISOString().slice(0, 10);
};

function AttendancePage() {
  return (
    <JobRequiredGate feature="Attendance">
      <AttendanceInner />
    </JobRequiredGate>
  );
}

function AttendanceInner() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [openSession, setOpenSession] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [overtime, setOvertime] = useState<{ date: string; hours: number }[]>([]);

  const load = async () => {
    if (!user) return;
    const since = new Date(); since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString().slice(0, 10);
    
    // Handle attendance query with error handling
    let attData: any[] = [];
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .gte("work_date", sinceIso)
        .order("check_in_at", { ascending: false });
      if (error) {
        console.error("Attendance fetch error:", error);
      } else {
        attData = data || [];
      }
    } catch (err) {
      console.error("Attendance query failed:", err);
    }
    
    // Handle incentive_pocket query separately with error handling
    let otData: any[] = [];
    try {
      const { data } = await supabase
        .from("incentive_pocket")
        .select("date, hours")
        .eq("user_id", user.id)
        .eq("source", "overtime")
        .gte("date", sinceIso);
      otData = data || [];
    } catch {
      // Table may not exist, ignore
    }
    
    const list = attData as Row[];
    setRows(list);
    setOvertime(otData.map((r) => ({ date: r.date, hours: Number(r.hours) || 0 })));
    const open = list.find((r) => !r.check_out_at);
    setOpenSession(open || null);
  };
  useEffect(() => { void load(); }, [user]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const checkIn = async () => {
    if (!user) return;
    if (openSession) {
      toast.info("You already have an open session — check out first.");
      return;
    }
    setLoading(true);
    const now = new Date();
    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      work_date: todayIso(),
      check_in_at: now.toISOString(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Checked in. Have a productive session!");
    void load();
  };
  const checkOut = async () => {
    if (!user || !openSession) return;
    setLoading(true);
    const checkOutAt = new Date();
    const checkInAt = new Date(openSession.check_in_at);
    const hoursWorked = Math.round((checkOutAt.getTime() - checkInAt.getTime()) / (1000 * 60 * 60) * 100) / 100;
    const { error } = await supabase
      .from("attendance")
      .update({
        check_out_at: checkOutAt.toISOString(),
        hours_worked: hoursWorked,
      })
      .eq("id", openSession.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Checked out. ${hoursWorked.toFixed(2)} hours recorded!`);
    void load();
  };

  // Aggregate by day for stats / display
  const today = todayIso();
  const todayRows = rows.filter((r) => r.work_date === today);
  const todayClosedHours = todayRows.reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);

  const last7Iso = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();
  const last7 = rows.filter((r) => r.work_date >= last7Iso);
  const totalHours7 = last7.reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);
  const presentDays7 = new Set(last7.filter((r) => r.hours_worked !== null).map((r) => r.work_date)).size;
  const last30Hours = rows.reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);

  const activeElapsed = openSession
    ? ((now - new Date(openSession.check_in_at).getTime()) / 3_600_000)
    : 0;

  // group rows by date for the history list
  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byDay.has(r.work_date)) byDay.set(r.work_date, []);
    byDay.get(r.work_date)!.push(r);
  }
  // overtime hours by day for badges in history list
  const otByDay = new Map<string, number>();
  for (const o of overtime) otByDay.set(o.date, (otByDay.get(o.date) || 0) + o.hours);
  const totalOvertime30 = overtime.reduce((s, o) => s + o.hours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Sessions are auto-capped at 8 hours. Anything beyond that is credited as overtime to your incentive pocket.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div
          className="rounded-xl p-6 text-nav-foreground shadow-[var(--shadow-elegant)]"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-90">
            <Calendar className="h-3.5 w-3.5" /> Today · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          {!openSession ? (
            <>
              <div className="mt-3 text-3xl font-bold tabular-nums">{todayClosedHours.toFixed(2)} hrs today</div>
              <p className="mt-1 text-sm opacity-90">
                {todayRows.length === 0 ? "You haven't checked in yet today." : `${todayRows.length} session${todayRows.length > 1 ? "s" : ""} closed — start another whenever you're ready.`}
              </p>
              <AzButton size="lg" variant="brand" disabled={loading} onClick={checkIn} className="mt-5 bg-white text-primary hover:bg-white/90">
                <LogIn className="mr-2 h-4 w-4" /> {todayRows.length === 0 ? "Check in now" : "Start a new session"}
              </AzButton>
            </>
          ) : (
            <>
              <div className="mt-3 text-3xl font-bold tabular-nums">{activeElapsed.toFixed(2)} hrs</div>
              <p className="mt-1 text-sm opacity-90">
                Live · started at {new Date(openSession.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · already {todayClosedHours.toFixed(2)}h closed today
              </p>
              <AzButton size="lg" variant="brand" disabled={loading} onClick={checkOut} className="mt-5 bg-white text-primary hover:bg-white/90">
                <LogOut className="mr-2 h-4 w-4" /> Check out
              </AzButton>
            </>
          )}
        </div>

        <div className="grid gap-3">
          <Stat Icon={Clock} label="This week (7d)" value={`${totalHours7.toFixed(1)} hrs`} sub={`${presentDays7}/7 days present`} />
          <Stat Icon={TrendingUp} label="Last 30 days" value={`${last30Hours.toFixed(1)} hrs`} sub={`${rows.length} sessions`} />
          <Stat Icon={Zap} label="Overtime (30d)" value={`${totalOvertime30.toFixed(1)} hrs`} sub="Credited to incentive pocket" />
        </div>
      </section>

      <section className="rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-bold">Recent attendance</h2>
          <span className="text-xs text-muted-foreground">Last 30 days</span>
        </div>
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No attendance records yet — check in to start tracking.</div>
        ) : (
          <div className="divide-y">
            {Array.from(byDay.entries()).map(([date, sessions]) => {
              const dayHours = sessions.reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);
              const dayOt = otByDay.get(date) || 0;
              return (
                <div key={date} className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-bold">{new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" })}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span><Coffee className="mr-1 inline h-3 w-3" />{sessions.length} session{sessions.length > 1 ? "s" : ""}</span>
                      <span className="font-bold text-success">{dayHours.toFixed(2)} hrs</span>
                      {dayOt > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 font-bold text-warning-foreground" title="Auto-credited overtime beyond the 8h cap">
                          <Zap className="h-3 w-3" /> +{dayOt.toFixed(2)} OT
                        </span>
                      )}
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {sessions.map((r) => (
                      <li key={r.id} className="flex flex-wrap gap-x-3">
                        <span>{new Date(r.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} → {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : <span className="font-bold text-warning-foreground">open</span>}</span>
                        <span>{r.hours_worked ? `${Number(r.hours_worked).toFixed(2)} hrs` : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ Icon, label, value, sub }: { Icon: any; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]" style={{ background: "var(--gradient-card)" }}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary"><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
