import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users, Calendar, TrendingUp, Moon, Sun, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/admin/attendance")({ component: AdminAttendancePage });

const STANDARD_HOURS_PER_DAY = 8;

type Employee = { id: string; full_name: string | null; email: string | null };
type AttendanceRow = {
  id: string;
  user_id: string;
  work_date: string;
  check_in_at: string;
  check_out_at: string | null;
  hours_worked: number | null;
  notes: string | null;
};
type MonthlyStats = {
  totalSessions: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  workDays: number;
  absentDays: number;
};

function AdminAttendancePage() {
  const [view, setView] = useState<"daily" | "monthly">("daily");
  const [day, setDay] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dailyRows, setDailyRows] = useState<(AttendanceRow & { full_name: string | null; email: string | null })[]>([]);
  const [monthlyData, setMonthlyData] = useState<(AttendanceRow & { full_name: string | null; email: string | null })[]>([]);
  const [loading, setLoading] = useState(true);

  // Load employees list
  useEffect(() => {
    void (async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      setEmployees((profiles || []).map((p: any) => ({ id: p.id, full_name: p.full_name, email: p.email })));
    })();
  }, []);

  // Load daily data
  useEffect(() => {
    if (view !== "daily") return;
    setLoading(true);
    void (async () => {
      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .eq("work_date", day)
        .order("check_in_at", { ascending: false });
      const ids = Array.from(new Set((att || []).map((a) => a.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as any[] };
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      setDailyRows((att || []).map((a: any) => ({ ...a, full_name: map.get(a.user_id)?.full_name || null, email: map.get(a.user_id)?.email || null })));
      setLoading(false);
    })();
  }, [day, view]);

  // Load monthly data
  useEffect(() => {
    if (view !== "monthly") return;
    setLoading(true);
    void (async () => {
      const [year, mon] = month.split("-");
      const startDate = `${year}-${mon}-01`;
      const endDate = new Date(Number(year), Number(mon), 0).toISOString().slice(0, 10);

      let query = supabase
        .from("attendance")
        .select("*")
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .order("work_date", { ascending: false });

      if (selectedEmployee !== "all") {
        query = query.eq("user_id", selectedEmployee);
      }

      const { data: att } = await query;
      const ids = Array.from(new Set((att || []).map((a) => a.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as any[] };
      const map = new Map((profiles || []).map((p: any) => [p.id, p]));
      setMonthlyData((att || []).map((a: any) => ({ ...a, full_name: map.get(a.user_id)?.full_name || null, email: map.get(a.user_id)?.email || null })));
      setLoading(false);
    })();
  }, [month, selectedEmployee, view]);

  // Calculate monthly stats
  const monthlyStats: MonthlyStats = useMemo(() => {
    const sessions = monthlyData.filter((r) => r.check_out_at); // Completed sessions
    const totalHours = sessions.reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);
    const workDays = new Set(sessions.map((r) => r.work_date)).size;
    const workingDaysInMonth = getWorkingDaysInMonth(month);
    const absentDays = Math.max(0, workingDaysInMonth - workDays);

    // Calculate regular vs overtime (8 hours/day standard)
    let regularHours = 0;
    let overtimeHours = 0;
    const dailyHours: Record<string, number> = {};
    sessions.forEach((r) => {
      const hrs = Number(r.hours_worked) || 0;
      dailyHours[r.work_date] = (dailyHours[r.work_date] || 0) + hrs;
    });
    Object.values(dailyHours).forEach((hrs) => {
      regularHours += Math.min(hrs, STANDARD_HOURS_PER_DAY);
      overtimeHours += Math.max(0, hrs - STANDARD_HOURS_PER_DAY);
    });

    return { totalSessions: sessions.length, totalHours, regularHours, overtimeHours, workDays, absentDays };
  }, [monthlyData, month]);

  const totalHours = dailyRows.reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);
  const open = dailyRows.filter((r) => !r.check_out_at).length;

  const navigateMonth = (direction: number) => {
    const [year, mon] = month.split("-").map(Number);
    const newDate = new Date(year, mon - 1 + direction, 1);
    setMonth(newDate.toISOString().slice(0, 7));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">Track employee attendance, sessions, and overtime.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-input bg-white p-1">
            <button
              onClick={() => setView("daily")}
              className={`px-3 py-1 text-sm font-medium rounded ${view === "daily" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Sun className="inline h-4 w-4 mr-1" /> Daily
            </button>
            <button
              onClick={() => setView("monthly")}
              className={`px-3 py-1 text-sm font-medium rounded ${view === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Moon className="inline h-4 w-4 mr-1" /> Monthly
            </button>
          </div>
        </div>
      </div>

      {/* Daily View */}
      {view === "daily" && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-4 sm:grid-cols-3 flex-1">
              <KPI Icon={Users} label="Employees present" value={String(dailyRows.length)} />
              <KPI Icon={Clock} label="Total hours" value={`${totalHours.toFixed(1)}h`} />
              <KPI Icon={Briefcase} label="Open sessions" value={String(open)} />
            </div>
            <label className="text-sm">
              <span className="mr-2 font-bold">Date</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded border border-input bg-white px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="rounded-xl border bg-card shadow-[var(--shadow-card)]">
            <div className="border-b p-4 font-bold">Sessions on {new Date(day).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : dailyRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No attendance for this day.</div>
            ) : (
              <div className="divide-y text-sm">
                {dailyRows.map((r) => (
                  <div key={r.id} className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-5">
                    <div className="font-bold sm:col-span-2">{r.full_name || "—"}<div className="text-xs font-normal text-muted-foreground">{r.email}</div></div>
                    <div className="text-muted-foreground">In: {new Date(r.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="text-muted-foreground">Out: {r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : <span className="text-warning-foreground">open</span>}</div>
                    <div className="font-bold text-success tabular-nums">{r.hours_worked ? `${Number(r.hours_worked).toFixed(2)} hrs` : "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Monthly View */}
      {view === "monthly" && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => navigateMonth(-1)} className="rounded border border-input bg-white p-2 hover:bg-secondary">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="rounded border border-input bg-white px-4 py-2 text-sm font-bold min-w-[140px] text-center">
                {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </div>
              <button onClick={() => navigateMonth(1)} className="rounded border border-input bg-white p-2 hover:bg-secondary">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="rounded border border-input bg-white px-3 py-2 text-sm"
            >
              <option value="all">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name || e.email || e.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>

          {/* Monthly Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPI Icon={Calendar} label="Work Days" value={String(monthlyStats.workDays)} subtext={`Absent: ${monthlyStats.absentDays} days`} />
            <KPI Icon={Clock} label="Total Hours" value={`${monthlyStats.totalHours.toFixed(1)}h`} subtext={`${monthlyStats.totalSessions} sessions`} />
            <KPI Icon={Sun} label="Regular Hours" value={`${monthlyStats.regularHours.toFixed(1)}h`} subtext={`Standard: ${STANDARD_HOURS_PER_DAY}h/day`} />
            <KPI Icon={TrendingUp} label="Overtime" value={`${monthlyStats.overtimeHours.toFixed(1)}h`} subtext={monthlyStats.overtimeHours > 0 ? "Above standard" : "No overtime"} accent />
          </div>

          {/* Monthly Detail Table */}
          <div className="rounded-xl border bg-card shadow-[var(--shadow-card)]">
            <div className="border-b p-4 font-bold flex items-center justify-between">
              <span>Attendance Records</span>
              <span className="text-xs font-normal text-muted-foreground">{monthlyData.length} entries</span>
            </div>
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : monthlyData.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No attendance records for this month.</div>
            ) : (
              <div className="divide-y text-sm">
                <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-secondary/30 text-xs font-bold uppercase text-muted-foreground">
                  <div className="col-span-2">Employee</div>
                  <div>Date</div>
                  <div>Check In</div>
                  <div>Check Out</div>
                  <div className="text-right">Hours</div>
                </div>
                {monthlyData.map((r) => {
                  const hrs = Number(r.hours_worked) || 0;
                  const isOvertime = hrs > STANDARD_HOURS_PER_DAY;
                  return (
                    <div key={r.id} className="grid grid-cols-6 gap-2 px-4 py-3 hover:bg-secondary/20">
                      <div className="col-span-2 font-medium">{r.full_name || "—"}<div className="text-xs text-muted-foreground">{r.email}</div></div>
                      <div className="text-muted-foreground">{new Date(r.work_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                      <div className="tabular-nums">{new Date(r.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="tabular-nums">{r.check_out_at ? new Date(r.check_out_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : <span className="text-warning">—</span>}</div>
                      <div className={`text-right font-bold tabular-nums ${isOvertime ? "text-warning" : "text-success"}`}>
                        {hrs.toFixed(2)}h
                        {isOvertime && <span className="ml-1 text-xs">(+{(hrs - STANDARD_HOURS_PER_DAY).toFixed(1)})</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ Icon, label, value, subtext, accent }: { Icon: any; label: string; value: string; subtext?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] ${accent ? "border-warning/50 bg-warning/5" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${accent ? "bg-warning/20 text-warning" : "bg-primary/15 text-primary"}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${accent ? "text-warning" : ""}`}>{value}</div>
      {subtext && <div className="mt-1 text-xs text-muted-foreground">{subtext}</div>}
    </div>
  );
}

function getWorkingDaysInMonth(monthStr: string): number {
  const [year, mon] = monthStr.split("-").map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, mon - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++; // Exclude weekends
  }
  return workingDays;
}
