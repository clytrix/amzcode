import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AzButton } from "@/components/az-button";
import { inr } from "@/lib/currency";
import { adminProcessWithdrawal } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/withdrawals")({ component: AdminWithdrawals });

function AdminWithdrawals() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    let q = supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false });
    if (filter === "pending") q = q.in("status", ["pending", "approved"]);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setRows([]); return; }
    const list = (data as any[]) || [];
    const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean)));
    const map: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
      for (const p of (profs as any[]) || []) map[p.id] = p;
    }
    setRows(list.map((r) => ({ ...r, profiles: map[r.user_id] || null })));
  };
  useEffect(() => { void load(); }, [filter]);

  const update = async (id: string, status: "approved" | "paid" | "rejected") => {
    if (!user) return;
    try {
      await adminProcessWithdrawal({ data: { id, action: status, admin_notes: notes[id] || null, wallet: "salary" } });
      toast.success(`Marked as ${status}`);
      void load();
    } catch (e: any) {
      toast.error(e?.message || "Could not update withdrawal");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="rounded border border-input bg-white px-3 py-2 text-sm">
          <option value="pending">Pending / approved</option>
          <option value="all">All requests</option>
        </select>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">No withdrawal requests.</div>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-md border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold">{inr(r.amount)}</div>
                <div className="text-sm">{r.profiles?.full_name || "(no name)"} · <span className="text-muted-foreground">{r.profiles?.email}</span></div>
                <div className="text-xs text-muted-foreground">Requested {new Date(r.created_at).toLocaleString("en-IN")}</div>
              </div>
              <span className={`rounded px-2 py-1 text-xs font-bold capitalize ${r.status === "paid" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>{r.status}</span>
            </div>
            <div className="mt-2 text-sm"><b>Method:</b> {r.payout_method}</div>
            {r.payout_details && <div className="mt-1 rounded bg-secondary/40 p-2 text-xs whitespace-pre-wrap">{r.payout_details}</div>}
            {r.service_fee_amount > 0 && (
              <>
                <div className="mt-2 text-xs text-muted-foreground"><b>Service Fee (18%):</b> {inr(r.service_fee_amount)}</div>
                {r.service_fee_payment_utr && <div className="mt-1 text-xs text-muted-foreground"><b>Service Fee UTR:</b> {r.service_fee_payment_utr}</div>}
                {r.service_fee_screenshot_url && (
                  <div className="mt-1">
                    <a href={r.service_fee_screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View Screenshot</a>
                  </div>
                )}
              </>
            )}
            {r.admin_notes && <div className="mt-2 text-xs text-muted-foreground"><b>Note:</b> {r.admin_notes}</div>}
            {(r.status === "pending" || r.status === "approved") && (
              <div className="mt-3 space-y-2">
                <textarea placeholder="Optional admin note (transaction ID, reason for rejection, etc.)" value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} rows={2} className="w-full rounded border border-input bg-white px-3 py-2 text-sm" />
                <div className="flex flex-wrap gap-2">
                  {r.status === "pending" && <AzButton size="sm" variant="outline" onClick={() => update(r.id, "approved")}>Approve</AzButton>}
                  <AzButton size="sm" variant="brand" onClick={() => update(r.id, "paid")}>Mark as paid</AzButton>
                  <AzButton size="sm" variant="outline" onClick={() => update(r.id, "rejected")}>Reject</AzButton>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
