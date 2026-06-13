import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AzButton } from "@/components/az-button";
import { setDisbursementStatus } from "@/server/salary.functions";
import { inr } from "@/lib/currency";
import { Banknote, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/salary-disbursements")({
  component: AdminDisbursements,
});

type Row = {
  id: string;
  user_id: string;
  period_year: number;
  period_month: number;
  basic_amount: number;
  overtime_amount: number;
  bonus: number;
  deductions: number;
  net_amount: number;
  status: "pending" | "held" | "paid" | "cancelled";
  hold_reason: string | null;
  paid_at: string | null;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
};

const STATUSES: Row["status"][] = ["pending", "held", "paid", "cancelled"];

function AdminDisbursements() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() === 0 ? 12 : now.getMonth());
  const [statusFilter, setStatusFilter] = useState<Row["status"] | "all">("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    let q = supabase
      .from("salary_disbursements")
      .select("*")
      .eq("period_year", year)
      .eq("period_month", month)
      .order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) {
      toast.error(error.message);
      return;
    }
    const userIds = Array.from(new Set((data || []).map((r: any) => r.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] as any[] };
    const pMap = new Map((profs || []).map((p: any) => [p.id, p]));
    setRows(
      (data as Row[]).map((r) => ({
        ...r,
        full_name: pMap.get(r.user_id)?.full_name || null,
        email: pMap.get(r.user_id)?.email || null,
      })),
    );
  };
  useEffect(() => { void load(); }, [year, month, statusFilter]);

  const update = async (id: string, status: Row["status"]) => {
    setBusy(id);
    try {
      await setDisbursementStatus({ data: { id, status } });
      toast.success(`Marked ${status}`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const generateNow = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/public/hooks/generate-salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation failed");
      toast.success(`Generated ${json.generated || 0} disbursement(s)`);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Salary disbursements</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Monthly salary queue per employee. Approve to pay or hold for KYC issues.
          </p>
        </div>
        <AzButton variant="outline" onClick={generateNow} disabled={generating}>
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} /> Generate {month}/{year}
        </AzButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3 text-sm">
        <label className="flex items-center gap-2">
          Year
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded border border-input bg-white px-2 py-1">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Month
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border border-input bg-white px-2 py-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded border border-input bg-white px-2 py-1">
            <option value="all">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <Th>Employee</Th><Th>Period</Th><Th className="text-right">Basic</Th>
              <Th className="text-right">Overtime</Th><Th className="text-right">Net</Th>
              <Th>Status</Th><Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <Td>
                  <div className="font-semibold">{r.full_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </Td>
                <Td>{String(r.period_month).padStart(2, "0")}/{r.period_year}</Td>
                <Td className="text-right">{inr(r.basic_amount)}</Td>
                <Td className="text-right">{inr(r.overtime_amount)}</Td>
                <Td className="text-right font-bold">{inr(r.net_amount)}</Td>
                <Td>
                  <span className={`rounded px-2 py-0.5 text-xs font-bold capitalize ${
                    r.status === "paid" ? "bg-success/15 text-success" :
                    r.status === "held" ? "bg-warning/15 text-warning-foreground" :
                    r.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                    "bg-secondary"
                  }`}>{r.status}</span>
                  {r.hold_reason && <div className="mt-0.5 text-[10px] text-muted-foreground">{r.hold_reason}</div>}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {r.status !== "paid" && <AzButton size="sm" variant="brand" disabled={busy === r.id} onClick={() => update(r.id, "paid")}>Mark paid</AzButton>}
                    {r.status === "held" && <AzButton size="sm" variant="outline" disabled={busy === r.id} onClick={() => update(r.id, "pending")}>Release hold</AzButton>}
                    {r.status === "pending" && <AzButton size="sm" variant="outline" disabled={busy === r.id} onClick={() => update(r.id, "held")}>Hold</AzButton>}
                    {r.status !== "cancelled" && r.status !== "paid" && <AzButton size="sm" variant="outline" disabled={busy === r.id} onClick={() => update(r.id, "cancelled")}>Cancel</AzButton>}
                  </div>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                No disbursements for {month}/{year}. Click "Generate" to create them from active packages.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className }: any) { return <th className={`px-3 py-2 text-left font-bold ${className || ""}`}>{children}</th>; }
function Td({ children, className }: any) { return <td className={`px-3 py-2 ${className || ""}`}>{children}</td>; }
