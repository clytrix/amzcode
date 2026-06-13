import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { Plus, Trash2 } from "lucide-react";
import { adminDeleteSalarySlip } from "@/server/admin.functions";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NOW = new Date();

export const Route = createFileRoute("/admin/salary-slips")({ component: AdminSlips });

function AdminSlips() {
  const { user } = useAuth();
  const [slips, setSlips] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [f, setF] = useState({
    user_id: "", period_year: NOW.getFullYear(), period_month: NOW.getMonth() + 1,
    basic_salary: 18000, bonus: 0, deductions: 0, notes: "",
  });

  const load = async () => {
    const [s, p] = await Promise.all([
      supabase.from("salary_disbursements").select("*").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);
    const profileMap = new Map((p.data || []).map((pp: any) => [pp.id, pp]));
    setSlips(((s.data as any[]) || []).map((row) => ({ ...row, profiles: profileMap.get(row.user_id) || null })));
    setEmployees((p.data as any[]) || []);
  };
  useEffect(() => { void load(); }, []);

  const filtered = slips.filter((s) => {
    if (filterUser !== "all" && s.user_id !== filterUser) return false;
    if (filterYear !== "all" && String(s.period_year) !== filterYear) return false;
    return true;
  });

  const years = Array.from(new Set(slips.map((s) => s.period_year))).sort((a, b) => b - a);

  const download = (slip: any) => {
    const html = buildSlipHtml(slip);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `salary-slip-${slip.profiles?.full_name || slip.user_id}-${MONTHS[slip.period_month - 1]}-${slip.period_year}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const net = Number(f.basic_salary) + Number(f.bonus) - Number(f.deductions);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !f.user_id) return toast.error("Select an employee");
    const { error } = await supabase.from("salary_disbursements").insert({
      user_id: f.user_id, generated_by: user.id, period_year: Number(f.period_year), period_month: Number(f.period_month),
      basic_amount: Number(f.basic_salary), bonus: Number(f.bonus), deductions: Number(f.deductions), net_amount: net,
    });
    if (error) return toast.error(error.message);
    toast.success("Salary slip generated!");
    setCreating(false);
    setF({ ...f, user_id: "", basic_salary: 18000, bonus: 0, deductions: 0, notes: "" });
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Salary Slips</h1>
        <AzButton variant="brand" onClick={() => setCreating(!creating)}><Plus className="h-4 w-4" /> Generate slip</AzButton>
      </div>

      {creating && (
        <form onSubmit={create} className="grid gap-3 rounded-md border bg-card p-5 shadow-sm sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold">Employee</span>
            <select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })} required className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              <option value="">— Select employee —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.email} · {e.email}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold">Month</span>
            <select value={f.period_month} onChange={(e) => setF({ ...f, period_month: Number(e.target.value) })} className="w-full rounded border border-input bg-white px-3 py-2 text-sm">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <Field label="Year" type="number" v={f.period_year} on={(v) => setF({ ...f, period_year: Number(v) })} />
          <Field label="Basic salary (₹)" type="number" v={f.basic_salary} on={(v) => setF({ ...f, basic_salary: Number(v) })} />
          <Field label="Bonus / Incentives (₹)" type="number" v={f.bonus} on={(v) => setF({ ...f, bonus: Number(v) })} />
          <Field label="Deductions (PF/TDS, ₹)" type="number" v={f.deductions} on={(v) => setF({ ...f, deductions: Number(v) })} />
          <div className="flex items-end text-sm">Net pay: <span className="ml-2 text-lg font-bold text-success">{inr(net)}</span></div>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold">Notes (optional)</span>
            <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <AzButton variant="brand">Generate slip</AzButton>
            <AzButton type="button" variant="outline" onClick={() => setCreating(false)}>Cancel</AzButton>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 text-xs">
        <span className="ml-2 font-bold text-muted-foreground">Filters:</span>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="rounded border border-input bg-white px-2 py-1">
          <option value="all">All employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name || e.email}</option>)}
        </select>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="rounded border border-input bg-white px-2 py-1">
          <option value="all">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="ml-auto mr-2 text-muted-foreground">{filtered.length} of {slips.length} slips</span>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No salary slips match the filters.</div>}
        {filtered.map((s) => {
          const ageDays = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 86400000);
          const expired = ageDays > 60;
          return (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-0">
              <div>
                <div className="font-semibold">{s.profiles?.full_name || s.profiles?.email || "(unknown employee)"}</div>
                <div className="text-xs text-muted-foreground">
                  {MONTHS[s.period_month - 1]} {s.period_year} · Generated {new Date(s.created_at).toLocaleDateString("en-IN")}
                  {expired && <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">EXPIRED (60d)</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-success">{inr(s.net_amount)}</div>
                <AzButton size="sm" variant="outline" disabled={expired} onClick={() => download(s)}>Download</AzButton>
                <AzButton
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Delete this salary slip permanently?")) return;
                    try {
                      await adminDeleteSalarySlip({ data: { id: s.id } });
                      toast.success("Slip deleted");
                      void load();
                    } catch (e: any) { toast.error(e?.message || "Delete failed"); }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </AzButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: any; on: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold">{label}</span>
      <input type={type} value={v ?? ""} onChange={(e) => on(e.target.value)}
        className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
    </label>
  );
}

function fmt(n: any) { return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function buildSlipHtml(s: any): string {
  const p = s.profiles || {};
  return `<!doctype html><html><head><meta charset="utf-8"><title>Salary Slip</title>
<style>body{font-family:Arial,sans-serif;max-width:720px;margin:30px auto;padding:20px;color:#0F1111}
.h{background:#131A22;color:#fff;padding:20px;display:flex;justify-content:space-between;align-items:center}
.h .l{color:#FF9900;font-size:24px;font-weight:700}
.box{border:1px solid #ddd;padding:20px;margin-top:0}
table{width:100%;border-collapse:collapse;margin-top:14px}
td,th{padding:10px;border-bottom:1px solid #eee;text-align:left}
.right{text-align:right}.bold{font-weight:700}.tot{background:#f7f8fa}</style></head><body>
<div class="h"><div class="l">AWZ<span style="color:#fff">.Jobs</span></div><div>SALARY SLIP</div></div>
<div class="box">
<table><tr><td><b>Employee:</b> ${p.full_name || ""}</td><td><b>Email:</b> ${p.email || ""}</td></tr>
<tr><td><b>Period:</b> ${MONTHS[s.period_month-1]} ${s.period_year}</td><td><b>Generated:</b> ${new Date(s.created_at).toLocaleDateString("en-IN")}</td></tr></table>
<table>
<tr><th>Description</th><th class="right">Amount (INR)</th></tr>
<tr><td>Basic salary</td><td class="right">₹${fmt(s.basic_salary)}</td></tr>
<tr><td>Bonus / Incentives</td><td class="right">₹${fmt(s.bonus)}</td></tr>
<tr><td>Deductions (PF / TDS)</td><td class="right">- ₹${fmt(s.deductions)}</td></tr>
<tr class="tot"><td class="bold">Net pay</td><td class="right bold">₹${fmt(s.net_amount)}</td></tr>
</table>
${s.notes ? `<p><b>Notes:</b> ${s.notes}</p>` : ""}
<p style="margin-top:24px;font-size:12px;color:#666">This is a computer-generated salary slip. No signature required.</p>
</div></body></html>`;
}

